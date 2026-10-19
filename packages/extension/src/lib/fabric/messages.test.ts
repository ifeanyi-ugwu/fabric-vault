import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { describe, it } from "node:test"
import { common } from "@hyperledger/fabric-protos"

import {
  CERT,
  CHANNEL,
  commitRequest,
  MSP_ID,
  network,
  preparedTransaction,
  proposal
} from "./fixtures"
import {
  DELIVER_SEEK_INFO,
  ENDORSER_TRANSACTION,
  parseBlockEventsRequest,
  parseChaincodeEventsRequest,
  parseCommitRequest,
  parsePreparedTransaction,
  parseProposedTransaction
} from "./messages"
import { DecodeError } from "./wire"

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)
const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex")

describe("parseProposedTransaction", () => {
  it("reads the call and the creator from a library-built proposal", () => {
    const built = proposal({ args: ["asset1", "Tom"] })
    const parsed = parseProposedTransaction(built.bytes)
    assert.equal(parsed.type, ENDORSER_TRANSACTION)
    assert.equal(parsed.channelId, CHANNEL)
    assert.equal(parsed.txId, built.txId)
    assert.equal(parsed.creator.mspId, MSP_ID)
    assert.equal(text(parsed.creator.certificate), CERT)
    assert.equal(parsed.invocation.chaincode, "basic")
    assert.deepEqual(parsed.invocation.args.map(text), [
      "Transfer",
      "asset1",
      "Tom"
    ])
    assert.equal(parsed.hasTransientData, false)
  })

  it("reads the contract-qualified function name", () => {
    const parsed = parseProposedTransaction(
      proposal({ contract: "AssetContract" }).bytes
    )
    assert.equal(text(parsed.invocation.args[0]), "AssetContract:Transfer")
  })

  it("reads a proposal with no arguments", () => {
    const parsed = parseProposedTransaction(proposal({ args: [] }).bytes)
    assert.deepEqual(parsed.invocation.args.map(text), ["Transfer"])
  })

  it("preserves an empty argument", () => {
    const parsed = parseProposedTransaction(proposal({ args: ["", "x"] }).bytes)
    assert.deepEqual(parsed.invocation.args.map(text), ["Transfer", "", "x"])
  })

  it("reports transient data", () => {
    assert.equal(
      parseProposedTransaction(proposal({ transient: true }).bytes)
        .hasTransientData,
      true
    )
  })

  it("covers exactly the bytes the library hashes", () => {
    const built = proposal()
    assert.equal(
      sha256(parseProposedTransaction(built.bytes).signedBytes),
      Buffer.from(built.digest).toString("hex")
    )
  })

  it("rejects bytes that are not a proposal", () => {
    assert.throws(
      () => parseProposedTransaction(Uint8Array.from([0x12, 0x09, 1])),
      DecodeError
    )
  })
})

describe("parsePreparedTransaction", () => {
  const txId = proposal().txId

  it("reads the header and each action", () => {
    const parsed = parsePreparedTransaction(
      preparedTransaction({ txId, actions: 2 })
    )
    assert.equal(parsed.type, ENDORSER_TRANSACTION)
    assert.equal(parsed.channelId, CHANNEL)
    assert.equal(parsed.txId, txId)
    assert.equal(parsed.creator.mspId, MSP_ID)
    assert.equal(parsed.actions.length, 2)
    assert.equal(parsed.actions[1].invocation.chaincode, "basic")
    assert.deepEqual(parsed.actions[1].invocation.args.map(text), [
      "Transfer",
      "asset1",
      "Tom"
    ])
  })

  it("covers the envelope payload", () => {
    const parsed = parsePreparedTransaction(preparedTransaction({ txId }))
    assert.ok(parsed.signedBytes.length > 0)
    assert.equal(
      common.Payload.deserializeBinary(parsed.signedBytes).hasHeader(),
      true
    )
  })

  it("reads a transaction with no actions", () => {
    assert.equal(
      parsePreparedTransaction(preparedTransaction({ txId, actions: 0 }))
        .actions.length,
      0
    )
  })
})

describe("parseCommitRequest", () => {
  it("reads the transaction, channel and identity", () => {
    const parsed = parseCommitRequest(commitRequest({ txId: "abc" }))
    assert.equal(parsed.txId, "abc")
    assert.equal(parsed.channelId, CHANNEL)
    assert.equal(parsed.identity.mspId, MSP_ID)
    assert.equal(text(parsed.identity.certificate), CERT)
  })
})

describe("parseChaincodeEventsRequest", () => {
  it("reads a library-built request", () => {
    const { bytes, digest } = network({}, (n) => {
      const request = n.newChaincodeEventsRequest("basic")
      return { bytes: request.getBytes(), digest: request.getDigest() }
    })
    const parsed = parseChaincodeEventsRequest(bytes)
    assert.equal(parsed.channelId, CHANNEL)
    assert.equal(parsed.chaincodeId, "basic")
    assert.equal(parsed.identity.mspId, MSP_ID)
    assert.equal(
      sha256(parsed.signedBytes),
      Buffer.from(digest).toString("hex")
    )
  })
})

describe("parseBlockEventsRequest", () => {
  it("reads a library-built request", () => {
    const { bytes, digest } = network({}, (n) => {
      const request = n.newBlockEventsRequest()
      return { bytes: request.getBytes(), digest: request.getDigest() }
    })
    const parsed = parseBlockEventsRequest(bytes)
    assert.equal(parsed.type, DELIVER_SEEK_INFO)
    assert.equal(parsed.channelId, CHANNEL)
    assert.equal(parsed.creator.mspId, MSP_ID)
    assert.equal(
      sha256(parsed.signedBytes),
      Buffer.from(digest).toString("hex")
    )
  })
})

describe("duplicate fields", () => {
  it("rejects a channel header that names the channel twice", () => {
    // ChannelHeader { channel_id = "a" } with field 4 written twice.
    const channelHeader = Uint8Array.from([0x22, 1, 97, 0x22, 1, 98])
    const header = new common.Header()
    header.setChannelHeader(channelHeader)
    const payload = new common.Payload()
    payload.setHeader(header)
    const envelope = new common.Envelope()
    envelope.setPayload(payload.serializeBinary())
    assert.throws(
      () => parseBlockEventsRequest(envelope.serializeBinary()),
      /appears 2 times/
    )
  })
})
