// Test fixtures: real Fabric wire bytes built with the Fabric Gateway client
// library and @hyperledger/fabric-protos. Imported by tests only.
import { createHash } from "node:crypto"
import { Client, credentials } from "@grpc/grpc-js"
import {
  connect,
  hash,
  type Gateway,
  type GrpcClient,
  type Network
} from "@hyperledger/fabric-gateway"
import { common, gateway, msp, peer } from "@hyperledger/fabric-protos"

import { bytesField, decode, messageField } from "./wire"

export const CERT =
  "-----BEGIN CERTIFICATE-----\nFIXTURE-CERT-A\n-----END CERTIFICATE-----\n"
export const OTHER_CERT =
  "-----BEGIN CERTIFICATE-----\nFIXTURE-CERT-B\n-----END CERTIFICATE-----\n"
export const MSP_ID = "Org1MSP"
export const CHANNEL = "mychannel"

const encoder = new TextEncoder()

export interface CallOptions {
  channel?: string
  chaincode?: string
  contract?: string
  fn?: string
  args?: string[]
  cert?: string
  mspId?: string
  transient?: boolean
}

/** A gateway handle with no network: it only builds and serialises requests. */
export function offline<T>(
  options: Pick<CallOptions, "cert" | "mspId">,
  use: (gateway: Gateway) => T
): T {
  const client = new Client("127.0.0.1:1", credentials.createInsecure())
  const gw = connect({
    // The client library resolves its own copy of @grpc/grpc-js.
    client: client as unknown as GrpcClient,
    identity: {
      mspId: options.mspId ?? MSP_ID,
      credentials: encoder.encode(options.cert ?? CERT)
    },
    signer: async () => new Uint8Array([1]),
    hash: hash.sha256
  })
  try {
    return use(gw)
  } finally {
    gw.close()
    client.close()
  }
}

export function proposal(options: CallOptions = {}) {
  return offline(options, (gw) => {
    const contract = gw
      .getNetwork(options.channel ?? CHANNEL)
      .getContract(options.chaincode ?? "basic", options.contract)
    const built = contract.newProposal(options.fn ?? "Transfer", {
      arguments: options.args ?? ["asset1", "Tom"],
      transientData: options.transient
        ? { secret: encoder.encode("x") }
        : undefined
    })
    return {
      bytes: built.getBytes(),
      txId: built.getTransactionId(),
      digest: built.getDigest()
    }
  })
}

export function network<T>(
  options: Pick<CallOptions, "cert" | "mspId" | "channel">,
  use: (network: Network) => T
): T {
  return offline(options, (gw) =>
    use(gw.getNetwork(options.channel ?? CHANNEL))
  )
}

function serializedIdentity(mspId: string, cert: string): Uint8Array {
  const identity = new msp.SerializedIdentity()
  identity.setMspid(mspId)
  identity.setIdBytes(encoder.encode(cert))
  return identity.serializeBinary()
}

function invocation(chaincode: string, fn: string, args: string[]): Uint8Array {
  const input = new peer.ChaincodeInput()
  input.setArgsList([fn, ...args].map((arg) => encoder.encode(arg)))
  const id = new peer.ChaincodeID()
  id.setName(chaincode)
  const spec = new peer.ChaincodeSpec()
  spec.setChaincodeId(id)
  spec.setInput(input)
  const invocationSpec = new peer.ChaincodeInvocationSpec()
  invocationSpec.setChaincodeSpec(spec)
  const payload = new peer.ChaincodeProposalPayload()
  payload.setInput(invocationSpec.serializeBinary())
  return payload.serializeBinary()
}

const sha256 = (...parts: Uint8Array[]) =>
  new Uint8Array(createHash("sha256").update(Buffer.concat(parts)).digest())

/** The headers of a proposal, as the endorsers hash them. */
function proposalHeaders(proposedTransaction: Uint8Array) {
  const proposal = decode(
    bytesField(messageField(decode(proposedTransaction), 2), 1)
  )
  const header = messageField(proposal, 1)
  return {
    channelHeader: bytesField(header, 1),
    signatureHeader: bytesField(header, 2)
  }
}

/** The same proposal with another transaction ID in its channel header. */
export function withTxId(
  proposedTransaction: Uint8Array,
  txId: string
): Uint8Array {
  const wrapper =
    gateway.ProposedTransaction.deserializeBinary(proposedTransaction)
  const signed = wrapper.getProposal()!
  const proposal = peer.Proposal.deserializeBinary(
    signed.getProposalBytes_asU8()
  )
  const header = common.Header.deserializeBinary(proposal.getHeader_asU8())
  const channelHeader = common.ChannelHeader.deserializeBinary(
    header.getChannelHeader_asU8()
  )
  channelHeader.setTxId(txId)
  header.setChannelHeader(channelHeader.serializeBinary())
  proposal.setHeader(header.serializeBinary())
  signed.setProposalBytes(proposal.serializeBinary())
  wrapper.setProposal(signed)
  return wrapper.serializeBinary()
}

/**
 * The endorsed transaction `Transaction.getBytes()` returns, built by hand.
 * `proposalBytes` is the proposal it answers. The `proposal_hash` is computed
 * from that proposal unless `proposalHash` overrides it.
 */
export function preparedTransaction(
  options: CallOptions & {
    proposalBytes: Uint8Array
    txId: string
    actions?: number
    proposalHash?: Uint8Array
  }
): Uint8Array {
  const signatureHeader = new common.SignatureHeader()
  signatureHeader.setCreator(
    serializedIdentity(options.mspId ?? MSP_ID, options.cert ?? CERT)
  )
  signatureHeader.setNonce(new Uint8Array([1, 2, 3]))

  const channelHeader = new common.ChannelHeader()
  channelHeader.setType(3)
  channelHeader.setChannelId(options.channel ?? CHANNEL)
  channelHeader.setTxId(options.txId)

  const header = new common.Header()
  header.setChannelHeader(channelHeader.serializeBinary())
  header.setSignatureHeader(signatureHeader.serializeBinary())

  const proposalHeader = proposalHeaders(options.proposalBytes)

  const actions = Array.from({ length: options.actions ?? 1 }, () => {
    const actionPayload = new peer.ChaincodeActionPayload()
    const chaincodeProposalPayload = invocation(
      options.chaincode ?? "basic",
      options.contract
        ? `${options.contract}:${options.fn ?? "Transfer"}`
        : options.fn ?? "Transfer",
      options.args ?? ["asset1", "Tom"]
    )
    actionPayload.setChaincodeProposalPayload(chaincodeProposalPayload)
    // ProposalResponsePayload { proposal_hash = 1 }, which the endorsers sign.
    const proposalHash =
      options.proposalHash ??
      sha256(
        proposalHeader.channelHeader,
        proposalHeader.signatureHeader,
        chaincodeProposalPayload
      )
    const endorsed = new peer.ChaincodeEndorsedAction()
    endorsed.setProposalResponsePayload(
      Uint8Array.from([0x0a, proposalHash.length, ...proposalHash])
    )
    actionPayload.setAction(endorsed)
    const action = new peer.TransactionAction()
    action.setHeader(signatureHeader.serializeBinary())
    action.setPayload(actionPayload.serializeBinary())
    return action
  })
  const transaction = new peer.Transaction()
  transaction.setActionsList(actions)

  const payload = new common.Payload()
  payload.setHeader(header)
  payload.setData(transaction.serializeBinary())
  const envelope = new common.Envelope()
  envelope.setPayload(payload.serializeBinary())

  const prepared = new gateway.PreparedTransaction()
  prepared.setTransactionId(options.txId)
  prepared.setEnvelope(envelope)
  return prepared.serializeBinary()
}

/** `Commit.getBytes()`, built by hand. */
export function commitRequest(options: {
  txId: string
  channel?: string
  cert?: string
  mspId?: string
}): Uint8Array {
  const request = new gateway.CommitStatusRequest()
  request.setTransactionId(options.txId)
  request.setChannelId(options.channel ?? CHANNEL)
  request.setIdentity(
    serializedIdentity(options.mspId ?? MSP_ID, options.cert ?? CERT)
  )
  const signed = new gateway.SignedCommitStatusRequest()
  signed.setRequest(request.serializeBinary())
  return signed.serializeBinary()
}
