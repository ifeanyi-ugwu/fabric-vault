import {
  bytesField,
  decode,
  hasField,
  intField,
  messageField,
  repeatedBytes,
  textField
} from "./wire"

export const ENDORSER_TRANSACTION = 3
export const DELIVER_SEEK_INFO = 5

/** `msp.SerializedIdentity`: the creator of a proposal or request. */
export interface SerializedIdentity {
  mspId: string
  certificate: Uint8Array
}

export interface ChaincodeInvocation {
  chaincode: string
  /** The first entry is the function, prefixed `contract:` when one is set. */
  args: Uint8Array[]
}

interface Header {
  type: number
  channelId: string
  txId: string
  creator: SerializedIdentity
  nonce: Uint8Array
}

export interface ProposalInfo extends Header {
  /** `SignedProposal.proposal_bytes`: the bytes the digest covers. */
  signedBytes: Uint8Array
  invocation: ChaincodeInvocation
  hasTransientData: boolean
}

export interface TransactionInfo extends Header {
  /** `Envelope.payload`: the bytes the digest covers. */
  signedBytes: Uint8Array
  actions: Array<{
    creator: SerializedIdentity
    invocation: ChaincodeInvocation
  }>
}

export interface CommitInfo {
  /** `SignedCommitStatusRequest.request`: the bytes the digest covers. */
  signedBytes: Uint8Array
  channelId: string
  txId: string
  identity: SerializedIdentity
}

export interface ChaincodeEventsInfo {
  /** `SignedChaincodeEventsRequest.request`: the bytes the digest covers. */
  signedBytes: Uint8Array
  channelId: string
  chaincodeId: string
  identity: SerializedIdentity
}

export interface BlockEventsInfo {
  /** `Envelope.payload`: the bytes the digest covers. */
  signedBytes: Uint8Array
  type: number
  channelId: string
  creator: SerializedIdentity
}

export function parseIdentity(bytes: Uint8Array): SerializedIdentity {
  const identity = decode(bytes)
  return {
    mspId: textField(identity, 1),
    certificate: bytesField(identity, 2)
  }
}

/** `common.Header`: a channel header and a signature header, both as bytes. */
function parseHeader(header: ReturnType<typeof decode>): Header {
  const channel = messageField(header, 1)
  const signature = messageField(header, 2)
  return {
    type: intField(channel, 1),
    channelId: textField(channel, 4),
    txId: textField(channel, 5),
    creator: parseIdentity(bytesField(signature, 1)),
    nonce: bytesField(signature, 2)
  }
}

/** `peer.ChaincodeProposalPayload`: `input` holds a `ChaincodeInvocationSpec`. */
function parseProposalPayload(payload: Uint8Array): {
  invocation: ChaincodeInvocation
  hasTransientData: boolean
} {
  const proposalPayload = decode(payload)
  const spec = messageField(messageField(proposalPayload, 1), 1)
  return {
    invocation: {
      chaincode: textField(messageField(spec, 2), 2),
      args: repeatedBytes(messageField(spec, 3), 1)
    },
    hasTransientData: hasField(proposalPayload, 2)
  }
}

/** `gateway.ProposedTransaction`, as returned by `Proposal.getBytes()`. */
export function parseProposedTransaction(bytes: Uint8Array): ProposalInfo {
  const signedProposal = messageField(decode(bytes), 2)
  const signedBytes = bytesField(signedProposal, 1)
  const proposal = decode(signedBytes)
  const { invocation, hasTransientData } = parseProposalPayload(
    bytesField(proposal, 2)
  )
  return {
    ...parseHeader(messageField(proposal, 1)),
    signedBytes,
    invocation,
    hasTransientData
  }
}

/** `gateway.PreparedTransaction`, as returned by `Transaction.getBytes()`. */
export function parsePreparedTransaction(bytes: Uint8Array): TransactionInfo {
  const envelope = messageField(decode(bytes), 2)
  const signedBytes = bytesField(envelope, 1)
  const payload = decode(signedBytes)
  const transaction = messageField(payload, 2)

  const actions = repeatedBytes(transaction, 1).map((encoded) => {
    const action = decode(encoded)
    const actionPayload = messageField(action, 2)
    return {
      creator: parseIdentity(bytesField(messageField(action, 1), 1)),
      invocation: parseProposalPayload(bytesField(actionPayload, 1)).invocation
    }
  })

  return {
    ...parseHeader(messageField(payload, 1)),
    signedBytes,
    actions
  }
}

/** `gateway.SignedCommitStatusRequest`, as returned by `Commit.getBytes()`. */
export function parseCommitRequest(bytes: Uint8Array): CommitInfo {
  const signedBytes = bytesField(decode(bytes), 1)
  const request = decode(signedBytes)
  return {
    signedBytes,
    txId: textField(request, 1),
    channelId: textField(request, 2),
    identity: parseIdentity(bytesField(request, 3))
  }
}

/** `gateway.SignedChaincodeEventsRequest`, from `ChaincodeEventsRequest.getBytes()`. */
export function parseChaincodeEventsRequest(
  bytes: Uint8Array
): ChaincodeEventsInfo {
  const signedBytes = bytesField(decode(bytes), 1)
  const request = decode(signedBytes)
  return {
    signedBytes,
    channelId: textField(request, 1),
    chaincodeId: textField(request, 2),
    identity: parseIdentity(bytesField(request, 3))
  }
}

/** `common.Envelope` carrying a `SeekInfo`, from `BlockEventsRequest.getBytes()`. */
export function parseBlockEventsRequest(bytes: Uint8Array): BlockEventsInfo {
  const signedBytes = bytesField(decode(bytes), 1)
  const header = parseHeader(messageField(decode(signedBytes), 1))
  return {
    signedBytes,
    type: header.type,
    channelId: header.channelId,
    creator: header.creator
  }
}
