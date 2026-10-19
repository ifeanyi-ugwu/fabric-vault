import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { gateway } from "@hyperledger/fabric-protos"

import {
  CERT,
  CHANNEL,
  commitRequest,
  MSP_ID,
  network,
  OTHER_CERT,
  preparedTransaction,
  proposal,
  type CallOptions
} from "./fixtures"
import { SigningSession, VerificationError, type ApprovedCall } from "./session"

const approved = (overrides: Partial<ApprovedCall> = {}): ApprovedCall => ({
  method: "fabric_submitTransaction",
  channel: CHANNEL,
  chaincode: "basic",
  fn: "Transfer",
  args: ["asset1", "Tom"],
  identity: { mspId: MSP_ID, certificate: CERT },
  ...overrides
})

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex")

const refused = (promise: Promise<unknown>, pattern?: RegExp) =>
  assert.rejects(promise, (error: Error) => {
    assert.ok(error instanceof VerificationError, String(error))
    if (pattern) assert.match(error.message, pattern)
    return true
  })

describe("a call that matches what was approved", () => {
  it("signs the digest the client library computes for a proposal", async () => {
    const built = proposal()
    const digest = await new SigningSession(approved()).verify(
      "proposal",
      built.bytes
    )
    assert.equal(hex(digest), hex(built.digest))
  })

  it("accepts the whole submit flow", async () => {
    const session = new SigningSession(approved())
    const { bytes, txId } = proposal()
    await session.verify("proposal", bytes)
    await session.verify("transaction", preparedTransaction({ txId }))
    await session.verify("commit", commitRequest({ txId }))
  })

  it("accepts a contract-qualified function", async () => {
    const session = new SigningSession(approved({ contract: "AssetContract" }))
    await session.verify(
      "proposal",
      proposal({ contract: "AssetContract" }).bytes
    )
  })

  it("accepts a call with no arguments", async () => {
    await new SigningSession(approved({ args: [] })).verify(
      "proposal",
      proposal({ args: [] }).bytes
    )
  })

  it("accepts the same proposal signed again", async () => {
    const session = new SigningSession(approved())
    const { bytes } = proposal()
    await session.verify("proposal", bytes)
    await session.verify("proposal", bytes)
  })

  it("accepts non-ASCII arguments", async () => {
    const args = ["café", "日本"]
    await new SigningSession(approved({ args })).verify(
      "proposal",
      proposal({ args }).bytes
    )
  })
})

describe("a proposal that differs from what was approved", () => {
  const cases: Array<[string, CallOptions, RegExp]> = [
    ["another channel", { channel: "otherchannel" }, /channel/],
    ["another chaincode", { chaincode: "other" }, /approved call/],
    ["another function", { fn: "Delete" }, /approved call/],
    ["another argument", { args: ["asset1", "Eve"] }, /approved call/],
    ["an extra argument", { args: ["asset1", "Tom", "x"] }, /approved call/],
    ["a missing argument", { args: ["asset1"] }, /approved call/],
    [
      "arguments in another order",
      { args: ["Tom", "asset1"] },
      /approved call/
    ],
    ["a contract that was not approved", { contract: "Evil" }, /approved call/],
    ["another certificate", { cert: OTHER_CERT }, /identity/],
    ["another MSP", { mspId: "Org2MSP" }, /identity/],
    ["transient data", { transient: true }, /transient/]
  ]
  for (const [name, options, pattern] of cases) {
    it(`is refused for ${name}`, async () => {
      await refused(
        new SigningSession(approved()).verify(
          "proposal",
          proposal(options).bytes
        ),
        pattern
      )
    })
  }

  it("is refused when the approved call named a contract and the proposal has none", async () => {
    await refused(
      new SigningSession(approved({ contract: "AssetContract" })).verify(
        "proposal",
        proposal().bytes
      ),
      /approved call/
    )
  })

  it("is refused when it is for a different transaction than the one signed", async () => {
    const session = new SigningSession(approved())
    await session.verify("proposal", proposal().bytes)
    await refused(
      session.verify("proposal", proposal().bytes),
      /different transaction/
    )
  })

  it("is refused when it is not a proposal at all", async () => {
    await refused(
      new SigningSession(approved()).verify(
        "proposal",
        Uint8Array.from([0x12, 9, 1])
      ),
      /Malformed proposal/
    )
  })
})

describe("a transaction or commit request", () => {
  it("is refused before any proposal is signed", async () => {
    const { txId } = proposal()
    const session = new SigningSession(approved())
    await refused(
      session.verify("transaction", preparedTransaction({ txId })),
      /No proposal/
    )
    await refused(
      session.verify("commit", commitRequest({ txId })),
      /No proposal/
    )
  })

  it("is refused for a different transaction ID", async () => {
    const session = new SigningSession(approved())
    await session.verify("proposal", proposal().bytes)
    const other = proposal().txId
    await refused(
      session.verify("transaction", preparedTransaction({ txId: other })),
      /different transaction/
    )
    await refused(
      session.verify("commit", commitRequest({ txId: other })),
      /different transaction/
    )
  })

  it("is refused for another channel", async () => {
    const session = new SigningSession(approved())
    const { bytes, txId } = proposal()
    await session.verify("proposal", bytes)
    await refused(
      session.verify(
        "transaction",
        preparedTransaction({ txId, channel: "other" })
      ),
      /different transaction/
    )
    await refused(
      session.verify("commit", commitRequest({ txId, channel: "other" })),
      /different transaction/
    )
  })

  it("is refused for another identity", async () => {
    const session = new SigningSession(approved())
    const { bytes, txId } = proposal()
    await session.verify("proposal", bytes)
    await refused(
      session.verify(
        "transaction",
        preparedTransaction({ txId, cert: OTHER_CERT })
      ),
      /identity/
    )
    await refused(
      session.verify("commit", commitRequest({ txId, cert: OTHER_CERT })),
      /identity/
    )
  })

  it("is refused when any action carries another call", async () => {
    const session = new SigningSession(approved())
    const { bytes, txId } = proposal()
    await session.verify("proposal", bytes)
    await refused(
      session.verify(
        "transaction",
        preparedTransaction({ txId, args: ["asset1", "Eve"] })
      ),
      /approved call/
    )
  })

  it("is refused with no actions", async () => {
    const session = new SigningSession(approved())
    const { bytes, txId } = proposal()
    await session.verify("proposal", bytes)
    await refused(
      session.verify("transaction", preparedTransaction({ txId, actions: 0 })),
      /no actions/
    )
  })
})

describe("the kinds a method may sign", () => {
  const refusesKind = async (
    method: ApprovedCall["method"],
    kind: "transaction" | "commit",
    pattern: RegExp
  ) => {
    const session = new SigningSession(approved({ method }))
    const { bytes, txId } = proposal()
    await session.verify("proposal", bytes)
    const request =
      kind === "transaction"
        ? preparedTransaction({ txId })
        : commitRequest({ txId })
    await refused(session.verify(kind, request), pattern)
  }

  it("lets an evaluate sign a proposal only", async () => {
    await refusesKind(
      "fabric_evaluateTransaction",
      "transaction",
      /does not sign a transaction/
    )
    await refusesKind(
      "fabric_evaluateTransaction",
      "commit",
      /does not sign a commit/
    )
  })

  it("keeps an async submit from signing a commit request", async () => {
    await refusesKind("fabric_submitAsync", "commit", /does not sign a commit/)
  })

  it("lets an async submit sign a proposal and a transaction", async () => {
    const session = new SigningSession(
      approved({ method: "fabric_submitAsync" })
    )
    const { bytes, txId } = proposal()
    await session.verify("proposal", bytes)
    await session.verify("transaction", preparedTransaction({ txId }))
  })

  it("refuses an event request for a call", async () => {
    const request = network({}, (n) => n.newBlockEventsRequest().getBytes())
    await refused(
      new SigningSession(approved()).verify("blockEvents", request),
      /does not sign a blockEvents/
    )
  })
})

describe("a chaincode event subscription", () => {
  const subscription = (chaincode = "basic", cert = CERT) =>
    new SigningSession({
      method: "chaincodeEvents",
      channel: CHANNEL,
      chaincode,
      identity: { mspId: MSP_ID, certificate: cert }
    })
  const request = (
    options: Parameters<typeof network>[0] = {},
    chaincode = "basic"
  ) =>
    network(options, (n) => n.newChaincodeEventsRequest(chaincode).getBytes())

  it("signs a matching request", async () => {
    await subscription().verify("chaincodeEvents", request())
  })

  it("refuses another chaincode", async () => {
    await refused(
      subscription().verify("chaincodeEvents", request({}, "other")),
      /chaincode/
    )
  })

  it("refuses another channel", async () => {
    await refused(
      subscription().verify("chaincodeEvents", request({ channel: "other" })),
      /channel/
    )
  })

  it("refuses another identity", async () => {
    await refused(
      subscription().verify("chaincodeEvents", request({ cert: OTHER_CERT })),
      /identity/
    )
  })

  it("refuses a proposal", async () => {
    await refused(
      subscription().verify("proposal", proposal().bytes),
      /does not sign a proposal/
    )
  })
})

describe("a block event subscription", () => {
  const subscription = (cert = CERT) =>
    new SigningSession({
      method: "blockEvents",
      channel: CHANNEL,
      identity: { mspId: MSP_ID, certificate: cert }
    })
  const request = (options: Parameters<typeof network>[0] = {}) =>
    network(options, (n) => n.newBlockEventsRequest().getBytes())

  it("signs a matching request", async () => {
    await subscription().verify("blockEvents", request())
  })

  it("refuses another channel", async () => {
    await refused(
      subscription().verify("blockEvents", request({ channel: "other" })),
      /channel/
    )
  })

  it("refuses another identity", async () => {
    await refused(
      subscription().verify("blockEvents", request({ cert: OTHER_CERT })),
      /identity/
    )
  })

  it("refuses an envelope whose header is not a seek request", async () => {
    const { txId } = proposal()
    const prepared = Uint8Array.from(preparedTransaction({ txId }))
    // PreparedTransaction wraps the envelope at field 2; a block events
    // request is the envelope alone, so unwrap it.
    const envelope = gateway.PreparedTransaction.deserializeBinary(prepared)
      .getEnvelope()!
      .serializeBinary()
    await refused(
      subscription().verify("blockEvents", envelope),
      /not a block seek request/
    )
  })
})
