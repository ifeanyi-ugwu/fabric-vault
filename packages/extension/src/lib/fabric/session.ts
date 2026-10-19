import {
  DELIVER_SEEK_INFO,
  ENDORSER_TRANSACTION,
  parseBlockEventsRequest,
  parseChaincodeEventsRequest,
  parseCommitRequest,
  parsePreparedTransaction,
  parseProposedTransaction,
  type ChaincodeInvocation,
  type SerializedIdentity
} from "./messages"
import { DecodeError } from "./wire"

export type SignKind =
  | "proposal"
  | "transaction"
  | "commit"
  | "chaincodeEvents"
  | "blockEvents"

export interface ApprovedIdentity {
  mspId: string
  certificate: string
}

/** A chaincode call the user approved. */
export interface ApprovedCall {
  method:
    | "fabric_evaluateTransaction"
    | "fabric_submitAsync"
    | "fabric_submitTransaction"
  channel: string
  chaincode: string
  contract?: string
  fn: string
  args: string[]
  identity: ApprovedIdentity
}

/** An event subscription a connected site started. */
export type ApprovedSubscription =
  | {
      method: "chaincodeEvents"
      channel: string
      chaincode: string
      identity: ApprovedIdentity
    }
  | { method: "blockEvents"; channel: string; identity: ApprovedIdentity }

export type Approved = ApprovedCall | ApprovedSubscription

export class VerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "VerificationError"
  }
}

const KINDS_PER_METHOD: Record<Approved["method"], ReadonlySet<SignKind>> = {
  fabric_evaluateTransaction: new Set(["proposal"]),
  fabric_submitAsync: new Set(["proposal", "transaction"]),
  fabric_submitTransaction: new Set(["proposal", "transaction", "commit"]),
  chaincodeEvents: new Set(["chaincodeEvents"]),
  blockEvents: new Set(["blockEvents"])
}

const encoder = new TextEncoder()

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i])
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
}

/**
 * Checks the bytes a gateway asks the extension to sign against the request
 * the user approved, and returns the digest to sign. One session covers one
 * approved call or subscription.
 */
export class SigningSession {
  private proposal?: {
    txId: string
    channelId: string
    channelHeader: Uint8Array
    signatureHeader: Uint8Array
  }

  constructor(private approved: Approved) {}

  /** Returns the SHA-256 digest of the signed bytes, or throws `VerificationError`. */
  async verify(kind: SignKind, bytes: Uint8Array): Promise<Uint8Array> {
    if (!KINDS_PER_METHOD[this.approved.method].has(kind)) {
      throw new VerificationError(
        `A ${this.approved.method} request does not sign a ${kind}.`
      )
    }
    try {
      return await sha256(await this.signedBytes(kind, bytes))
    } catch (error) {
      if (error instanceof DecodeError) {
        throw new VerificationError(`Malformed ${kind}: ${error.message}`)
      }
      throw error
    }
  }

  private async signedBytes(
    kind: SignKind,
    bytes: Uint8Array
  ): Promise<Uint8Array> {
    switch (kind) {
      case "proposal":
        return this.proposalBytes(bytes)
      case "transaction":
        return this.transactionBytes(bytes)
      case "commit":
        return this.commitBytes(bytes)
      case "chaincodeEvents":
        return this.chaincodeEventsBytes(bytes)
      case "blockEvents":
        return this.blockEventsBytes(bytes)
    }
  }

  private get call(): ApprovedCall {
    return this.approved as ApprovedCall
  }

  private async proposalBytes(bytes: Uint8Array): Promise<Uint8Array> {
    const proposal = parseProposedTransaction(bytes)
    if (proposal.type !== ENDORSER_TRANSACTION) {
      throw new VerificationError(
        "The proposal is not an endorser transaction."
      )
    }
    this.checkChannel(proposal.channelId)
    this.checkCreator(proposal.creator)
    this.checkInvocation(proposal.invocation)
    if (proposal.hasTransientData) {
      throw new VerificationError("The proposal carries transient data.")
    }
    if (!proposal.txId) {
      throw new VerificationError("The proposal has no transaction ID.")
    }
    // The ID is derived from the nonce and creator, so it commits the
    // proposal to the nonce that the endorsed transaction must also carry.
    const derivedTxId = hex(
      await sha256(concat(proposal.nonce, proposal.creatorBytes))
    )
    if (proposal.txId !== derivedTxId) {
      throw new VerificationError(
        "The transaction ID is not derived from the proposal's nonce and creator."
      )
    }
    if (this.proposal && this.proposal.txId !== proposal.txId) {
      throw new VerificationError(
        "The proposal is for a different transaction than the one already signed."
      )
    }
    this.proposal = {
      txId: proposal.txId,
      channelId: proposal.channelId,
      channelHeader: proposal.channelHeader,
      signatureHeader: proposal.signatureHeader
    }
    return proposal.signedBytes
  }

  private async transactionBytes(bytes: Uint8Array): Promise<Uint8Array> {
    const transaction = parsePreparedTransaction(bytes)
    if (transaction.type !== ENDORSER_TRANSACTION) {
      throw new VerificationError(
        "The transaction is not an endorser transaction."
      )
    }
    this.checkRecorded(transaction.txId, transaction.channelId)
    this.checkCreator(transaction.creator)
    if (transaction.actions.length === 0) {
      throw new VerificationError("The transaction has no actions.")
    }
    for (const action of transaction.actions) {
      this.checkCreator(action.creator)
      this.checkInvocation(action.invocation)
      // The endorsers sign the hash of the proposal they saw. Recomputing it
      // from the proposal signed here shows this transaction answers that
      // proposal, nonce included.
      const { channelHeader, signatureHeader } = this.proposal!
      const expected = await sha256(
        concat(channelHeader, signatureHeader, action.chaincodeProposalPayload)
      )
      if (!sameBytes(expected, action.proposalHash)) {
        throw new VerificationError(
          "The endorsed transaction is not for the proposal that was signed."
        )
      }
    }
    return transaction.signedBytes
  }

  private commitBytes(bytes: Uint8Array): Uint8Array {
    const commit = parseCommitRequest(bytes)
    this.checkRecorded(commit.txId, commit.channelId)
    this.checkCreator(commit.identity)
    return commit.signedBytes
  }

  private chaincodeEventsBytes(bytes: Uint8Array): Uint8Array {
    const request = parseChaincodeEventsRequest(bytes)
    const approved = this.approved as Extract<
      ApprovedSubscription,
      { method: "chaincodeEvents" }
    >
    this.checkChannel(request.channelId)
    if (request.chaincodeId !== approved.chaincode) {
      throw new VerificationError("The chaincode is not the one subscribed to.")
    }
    this.checkCreator(request.identity)
    return request.signedBytes
  }

  private blockEventsBytes(bytes: Uint8Array): Uint8Array {
    const request = parseBlockEventsRequest(bytes)
    if (request.type !== DELIVER_SEEK_INFO) {
      throw new VerificationError("The request is not a block seek request.")
    }
    this.checkChannel(request.channelId)
    this.checkCreator(request.creator)
    return request.signedBytes
  }

  private checkChannel(channelId: string): void {
    if (channelId !== this.approved.channel) {
      throw new VerificationError("The channel is not the approved channel.")
    }
  }

  private checkCreator(creator: SerializedIdentity): void {
    const { mspId, certificate } = this.approved.identity
    if (
      creator.mspId !== mspId ||
      !sameBytes(creator.certificate, encoder.encode(certificate))
    ) {
      throw new VerificationError("The identity is not the approved identity.")
    }
  }

  private checkInvocation(invocation: ChaincodeInvocation): void {
    const { chaincode, contract, fn, args } = this.call
    const expected = [contract ? `${contract}:${fn}` : fn, ...args].map((arg) =>
      encoder.encode(arg)
    )
    const matches =
      invocation.chaincode === chaincode &&
      invocation.args.length === expected.length &&
      invocation.args.every((arg, i) => sameBytes(arg, expected[i]))
    if (!matches) {
      throw new VerificationError("The call is not the approved call.")
    }
  }

  /** A transaction or commit request must belong to the proposal signed first. */
  private checkRecorded(txId: string, channelId: string): void {
    if (!this.proposal) {
      throw new VerificationError(
        "No proposal has been signed for this request."
      )
    }
    if (txId !== this.proposal.txId || channelId !== this.proposal.channelId) {
      throw new VerificationError(
        "The request is for a different transaction than the signed proposal."
      )
    }
  }
}
