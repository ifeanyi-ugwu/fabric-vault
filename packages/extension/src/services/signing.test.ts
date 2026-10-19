import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  CERT,
  CHANNEL,
  MSP_ID,
  network,
  OTHER_CERT,
  preparedTransaction,
  proposal
} from "../lib/fabric/fixtures"
import { SigningSession, type ApprovedCall } from "../lib/fabric/session"
import {
  answerSigningRequest,
  approvedCall,
  approvedSubscription,
  SIGNING_REFUSED,
  type Sign,
  type SigningContext
} from "./signing"
import { SigningGrants } from "./signing-grants"

const identity = { mspId: MSP_ID, certificate: CERT }
const call: ApprovedCall = {
  method: "fabric_submitTransaction",
  channel: CHANNEL,
  chaincode: "basic",
  fn: "Transfer",
  args: ["asset1", "Tom"],
  identity
}

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64")

function setup(
  options: {
    allowLegacyDigest?: boolean
    count?: number
    approved?: ApprovedCall
  } = {}
) {
  const grants = new SigningGrants<SigningContext>()
  grants.grant({
    certificate: CERT,
    origin: "https://dapp.example",
    count: options.count ?? 5,
    ttlMs: 60_000,
    context: {
      session: new SigningSession(options.approved ?? call),
      allowLegacyDigest: options.allowLegacyDigest ?? false
    }
  })
  const signed: Array<{ digest: string; certificate: string; origin: string }> =
    []
  const sign: Sign = async (digest, certificate, origin) => {
    signed.push({ digest, certificate, origin })
    return { success: true, signature: "SIGNATURE" }
  }
  const ask = (message: unknown) => answerSigningRequest(message, grants, sign)
  return { ask, signed, grants }
}

const signRequest = (kind: string, bytes: Uint8Array, certificate = CERT) => ({
  jsonrpc: "2.0",
  id: "1",
  method: "signRequest",
  params: { kind, bytes: base64(bytes), certificate }
})

const refusal = (reply: unknown, pattern: RegExp) => {
  const error = (reply as { error?: { code: number; message: string } }).error
  assert.ok(error, `expected a refusal, got ${JSON.stringify(reply)}`)
  assert.equal(error.code, SIGNING_REFUSED)
  assert.match(error.message, pattern)
}

describe("answerSigningRequest", () => {
  it("returns null for a message that is not a signing request", async () => {
    const { ask } = setup()
    assert.equal(await ask({ jsonrpc: "2.0", id: "1", result: {} }), null)
    assert.equal(await ask({ method: "fabric_subscription" }), null)
    assert.equal(await ask(null), null)
  })

  describe("signRequest", () => {
    it("signs the digest of a request that matches the approved call", async () => {
      const { ask, signed } = setup()
      const built = proposal()
      const reply = await ask(signRequest("proposal", built.bytes))
      assert.deepEqual(reply, { result: { signature: "SIGNATURE" } })
      assert.deepEqual(signed, [
        {
          digest: base64(built.digest),
          certificate: CERT,
          origin: "https://dapp.example"
        }
      ])
    })

    it("signs the whole submit flow", async () => {
      const { ask, signed } = setup()
      const { bytes, txId } = proposal()
      await ask(signRequest("proposal", bytes))
      await ask(
        signRequest(
          "transaction",
          preparedTransaction({ proposalBytes: bytes, txId })
        )
      )
      assert.equal(signed.length, 2)
    })

    it("refuses a request for another call and signs nothing", async () => {
      const { ask, signed } = setup()
      const reply = await ask(
        signRequest("proposal", proposal({ args: ["asset1", "Mallory"] }).bytes)
      )
      refusal(reply, /not the approved call/)
      assert.deepEqual(signed, [])
    })

    it("refuses a kind the approved request does not sign", async () => {
      const { ask, signed } = setup({
        approved: { ...call, method: "fabric_evaluateTransaction" }
      })
      const { bytes, txId } = proposal()
      await ask(signRequest("proposal", bytes))
      refusal(
        await ask(
          signRequest(
            "transaction",
            preparedTransaction({ proposalBytes: bytes, txId })
          )
        ),
        /does not sign a transaction/
      )
      assert.equal(signed.length, 1)
    })

    it("refuses a certificate with no live grant", async () => {
      const { ask, signed } = setup()
      refusal(
        await ask(signRequest("proposal", proposal().bytes, OTHER_CERT)),
        /No approved request/
      )
      assert.deepEqual(signed, [])
    })

    it("refuses once the grant's signatures are used", async () => {
      const { ask } = setup({ count: 1 })
      const { bytes } = proposal()
      assert.ok(
        "result" in ((await ask(signRequest("proposal", bytes))) as object)
      )
      refusal(await ask(signRequest("proposal", bytes)), /No approved request/)
    })

    it("refuses an unknown kind", async () => {
      const { ask } = setup()
      refusal(await ask(signRequest("anything", proposal().bytes)), /Malformed/)
    })

    it("refuses bytes that are not a string", async () => {
      const { ask } = setup()
      const message = signRequest("proposal", proposal().bytes)
      refusal(
        await ask({ ...message, params: { ...message.params, bytes: 7 } }),
        /Malformed/
      )
    })

    it("refuses bytes that are not valid base64", async () => {
      const { ask } = setup()
      const message = signRequest("proposal", proposal().bytes)
      refusal(
        await ask({ ...message, params: { ...message.params, bytes: "***" } }),
        /Malformed/
      )
    })

    it("refuses bytes that are not a protobuf message", async () => {
      const { ask } = setup()
      refusal(
        await ask(signRequest("proposal", Uint8Array.from([0x12, 9, 1]))),
        /Malformed proposal/
      )
    })

    it("refuses a message with no certificate", async () => {
      const { ask } = setup()
      const message = signRequest("proposal", proposal().bytes)
      refusal(
        await ask({
          ...message,
          params: { kind: "proposal", bytes: message.params.bytes }
        }),
        /Certificate not provided/
      )
    })

    it("passes on a failure to sign", async () => {
      const grants = new SigningGrants<SigningContext>()
      grants.grant({
        certificate: CERT,
        origin: "https://dapp.example",
        count: 1,
        ttlMs: 60_000,
        context: { session: new SigningSession(call), allowLegacyDigest: false }
      })
      const reply = await answerSigningRequest(
        signRequest("proposal", proposal().bytes),
        grants,
        async () => ({
          success: false,
          error: "Site is not connected to the requested identity."
        })
      )
      refusal(reply, /not connected/)
    })
  })

  describe("signDigest", () => {
    const signDigest = (
      digest: unknown = "AAAA",
      certificate: string = CERT
    ) => ({
      jsonrpc: "2.0",
      id: "1",
      method: "signDigest",
      params: { digest, certificate }
    })

    it("is refused by default and signs nothing", async () => {
      const { ask, signed } = setup()
      refusal(await ask(signDigest()), /legacy signing/)
      assert.deepEqual(signed, [])
    })

    it("is signed when legacy signing is on", async () => {
      const { ask, signed } = setup({ allowLegacyDigest: true })
      assert.deepEqual(await ask(signDigest("QUJD")), {
        result: { signature: "SIGNATURE" }
      })
      assert.deepEqual(signed, [
        { digest: "QUJD", certificate: CERT, origin: "https://dapp.example" }
      ])
    })

    it("still needs a live grant when legacy signing is on", async () => {
      const { ask } = setup({ allowLegacyDigest: true })
      refusal(await ask(signDigest("QUJD", OTHER_CERT)), /No approved request/)
    })

    it("is refused without a digest", async () => {
      const { ask } = setup({ allowLegacyDigest: true })
      refusal(await ask(signDigest(null)), /Digest not provided/)
    })
  })

  it("applies the session of the grant that matches the certificate", async () => {
    const grants = new SigningGrants<SigningContext>()
    for (const [certificate, fn] of [
      [CERT, "Transfer"],
      [OTHER_CERT, "Delete"]
    ] as const) {
      grants.grant({
        certificate,
        origin: "https://dapp.example",
        count: 1,
        ttlMs: 60_000,
        context: {
          session: new SigningSession({
            ...call,
            fn,
            identity: { mspId: MSP_ID, certificate }
          }),
          allowLegacyDigest: false
        }
      })
    }
    const sign: Sign = async () => ({ success: true, signature: "S" })
    const asOther = await answerSigningRequest(
      signRequest(
        "proposal",
        proposal({ cert: OTHER_CERT, fn: "Delete" }).bytes,
        OTHER_CERT
      ),
      grants,
      sign
    )
    assert.deepEqual(asOther, { result: { signature: "S" } })
  })
})

describe("answerSigningRequest for a subscription", () => {
  it("signs a matching chaincode events request and refuses another chaincode", async () => {
    const grants = new SigningGrants<SigningContext>()
    grants.grant({
      certificate: CERT,
      origin: "https://dapp.example",
      count: 2,
      ttlMs: 60_000,
      context: {
        session: new SigningSession({
          method: "chaincodeEvents",
          channel: CHANNEL,
          chaincode: "basic",
          identity
        }),
        allowLegacyDigest: false
      }
    })
    const sign: Sign = async () => ({ success: true, signature: "S" })
    const bytes = (chaincode: string) =>
      network({}, (n) => n.newChaincodeEventsRequest(chaincode).getBytes())
    assert.deepEqual(
      await answerSigningRequest(
        signRequest("chaincodeEvents", bytes("basic")),
        grants,
        sign
      ),
      { result: { signature: "S" } }
    )
    refusal(
      await answerSigningRequest(
        signRequest("chaincodeEvents", bytes("other")),
        grants,
        sign
      ),
      /chaincode/
    )
  })
})

describe("approvedCall", () => {
  it("reads a call with a chaincode name", () => {
    assert.deepEqual(
      approvedCall(
        "fabric_submitTransaction",
        { channel: "c", chaincode: "basic", fn: "Transfer", args: ["a", "b"] },
        identity
      ),
      {
        method: "fabric_submitTransaction",
        channel: "c",
        chaincode: "basic",
        contract: undefined,
        fn: "Transfer",
        args: ["a", "b"],
        identity
      }
    )
  })

  it("reads a chaincode given as an object with a contract", () => {
    const parsed = approvedCall(
      "fabric_evaluateTransaction",
      {
        channel: "c",
        chaincode: { name: "basic", contract: "Asset" },
        fn: "Read"
      },
      identity
    )
    assert.equal(parsed.chaincode, "basic")
    assert.equal(parsed.contract, "Asset")
    assert.deepEqual(parsed.args, [])
  })

  const refused: Array<[string, string, object]> = [
    [
      "an unsupported method",
      "fabric_subscribe",
      { channel: "c", chaincode: "x", fn: "f" }
    ],
    ["no channel", "fabric_submitAsync", { chaincode: "x", fn: "f" }],
    ["no function", "fabric_submitAsync", { channel: "c", chaincode: "x" }],
    ["no chaincode", "fabric_submitAsync", { channel: "c", fn: "f" }],
    [
      "a chaincode object with no name",
      "fabric_submitAsync",
      { channel: "c", chaincode: {}, fn: "f" }
    ],
    [
      "a contract that is not text",
      "fabric_submitAsync",
      { channel: "c", chaincode: { name: "x", contract: 3 }, fn: "f" }
    ],
    [
      "arguments that are not a list",
      "fabric_submitAsync",
      { channel: "c", chaincode: "x", fn: "f", args: "a" }
    ],
    [
      "an argument that is not text",
      "fabric_submitAsync",
      { channel: "c", chaincode: "x", fn: "f", args: ["a", 1] }
    ]
  ]
  for (const [name, method, params] of refused) {
    it(`refuses ${name}`, () => {
      assert.throws(() => approvedCall(method, params, identity), Error)
    })
  }
})

describe("approvedSubscription", () => {
  it("reads a chaincode event subscription", () => {
    assert.deepEqual(
      approvedSubscription(
        { eventType: "chaincode", channel: "c", chaincode: "basic" },
        identity
      ),
      { method: "chaincodeEvents", channel: "c", chaincode: "basic", identity }
    )
  })

  it("reads a chaincode given as an object", () => {
    const parsed = approvedSubscription(
      { eventType: "chaincode", channel: "c", chaincode: { name: "basic" } },
      identity
    )
    assert.equal((parsed as { chaincode: string }).chaincode, "basic")
  })

  it("reads a block event subscription", () => {
    assert.deepEqual(
      approvedSubscription({ eventType: "block", channel: "c" }, identity),
      {
        method: "blockEvents",
        channel: "c",
        identity
      }
    )
  })

  it("refuses an unknown event type and a missing channel", () => {
    assert.throws(
      () => approvedSubscription({ eventType: "x", channel: "c" }, identity),
      Error
    )
    assert.throws(
      () => approvedSubscription({ eventType: "block" }, identity),
      Error
    )
    assert.throws(
      () =>
        approvedSubscription(
          { eventType: "chaincode", channel: "c" },
          identity
        ),
      Error
    )
  })
})

describe("answerSigningRequest with several grants for one certificate", () => {
  const subscription = (
    grants: SigningGrants<SigningContext>,
    approved: ConstructorParameters<typeof SigningSession>[0],
    options: { count?: number; allowLegacyDigest?: boolean } = {}
  ) =>
    grants.grant({
      certificate: CERT,
      origin: "https://dapp.example",
      count: options.count ?? 2,
      ttlMs: 60_000,
      context: {
        session: new SigningSession(approved),
        allowLegacyDigest: options.allowLegacyDigest ?? false
      }
    })
  const sign: Sign = async () => ({ success: true, signature: "S" })
  const block = { method: "blockEvents", channel: CHANNEL, identity } as const
  const chaincode = (name: string) =>
    ({
      method: "chaincodeEvents",
      channel: CHANNEL,
      chaincode: name,
      identity
    }) as const
  const blockBytes = () =>
    network({}, (n) => n.newBlockEventsRequest().getBytes())
  const chaincodeBytes = (name: string) =>
    network({}, (n) => n.newChaincodeEventsRequest(name).getBytes())

  it("signs a chaincode subscription while a block subscription's grant is still live", async () => {
    // Each subscription's grant keeps one signature of margin, so the first
    // grant is still live, and expires first, when the second request arrives.
    const grants = new SigningGrants<SigningContext>()
    subscription(grants, block)
    assert.deepEqual(
      await answerSigningRequest(
        signRequest("blockEvents", blockBytes()),
        grants,
        sign
      ),
      { result: { signature: "S" } }
    )
    subscription(grants, chaincode("basic"))
    assert.deepEqual(
      await answerSigningRequest(
        signRequest("chaincodeEvents", chaincodeBytes("basic")),
        grants,
        sign
      ),
      { result: { signature: "S" } }
    )
  })

  it("checks a request against the grant of the chaincode it names", async () => {
    const grants = new SigningGrants<SigningContext>()
    subscription(grants, chaincode("first"))
    subscription(grants, chaincode("second"))
    assert.deepEqual(
      await answerSigningRequest(
        signRequest("chaincodeEvents", chaincodeBytes("second")),
        grants,
        sign
      ),
      { result: { signature: "S" } }
    )
  })

  it("spends only the grant that accepted the request", async () => {
    const grants = new SigningGrants<SigningContext>()
    subscription(grants, chaincode("first"), { count: 1 })
    subscription(grants, chaincode("second"), { count: 1 })
    await answerSigningRequest(
      signRequest("chaincodeEvents", chaincodeBytes("second")),
      grants,
      sign
    )
    // The first grant still has its signature.
    assert.deepEqual(
      await answerSigningRequest(
        signRequest("chaincodeEvents", chaincodeBytes("first")),
        grants,
        sign
      ),
      { result: { signature: "S" } }
    )
    refusal(
      await answerSigningRequest(
        signRequest("chaincodeEvents", chaincodeBytes("first")),
        grants,
        sign
      ),
      /No approved request/
    )
  })

  it("refuses a request no grant accepts, with the earliest grant's reason", async () => {
    const grants = new SigningGrants<SigningContext>()
    subscription(grants, chaincode("first"))
    subscription(grants, chaincode("second"))
    refusal(
      await answerSigningRequest(
        signRequest("chaincodeEvents", chaincodeBytes("third")),
        grants,
        sign
      ),
      /not the one subscribed to/
    )
  })

  it("spends nothing when a request is refused", async () => {
    const grants = new SigningGrants<SigningContext>()
    subscription(grants, chaincode("basic"), { count: 1 })
    refusal(
      await answerSigningRequest(
        signRequest("chaincodeEvents", chaincodeBytes("other")),
        grants,
        sign
      ),
      /not the one subscribed to/
    )
    assert.deepEqual(
      await answerSigningRequest(
        signRequest("chaincodeEvents", chaincodeBytes("basic")),
        grants,
        sign
      ),
      { result: { signature: "S" } }
    )
  })

  it("signs a digest under the grant that allows legacy signing", async () => {
    const grants = new SigningGrants<SigningContext>()
    subscription(grants, block)
    subscription(grants, chaincode("basic"), { allowLegacyDigest: true })
    const reply = await answerSigningRequest(
      { method: "signDigest", params: { digest: "QUJD", certificate: CERT } },
      grants,
      sign
    )
    assert.deepEqual(reply, { result: { signature: "S" } })
  })
})
