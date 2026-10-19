import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { SigningGrants } from "./signing-grants"

const setup = () => {
  let now = 0
  const grants = new SigningGrants(() => now)
  return { grants, advance: (ms: number) => (now += ms) }
}

const base = { certificate: "CERT", origin: "https://a.example", ttlMs: 1000 }

describe("SigningGrants", () => {
  it("refuses a certificate with no grant", () => {
    assert.equal(setup().grants.consume("CERT"), null)
  })

  it("returns the origin that authorised the grant", () => {
    const { grants } = setup()
    grants.grant({ ...base, count: 1 })
    assert.deepEqual(grants.consume("CERT"), {
      certificate: "CERT",
      origin: "https://a.example",
      context: undefined
    })
  })

  it("allows exactly the granted number of signatures", () => {
    const { grants } = setup()
    grants.grant({ ...base, count: 2 })
    assert.ok(grants.consume("CERT"))
    assert.ok(grants.consume("CERT"))
    assert.equal(grants.consume("CERT"), null)
  })

  it("refuses a different certificate", () => {
    const { grants } = setup()
    grants.grant({ ...base, count: 3 })
    assert.equal(grants.consume("OTHER"), null)
  })

  it("refuses after the grant expires", () => {
    const { grants, advance } = setup()
    grants.grant({ ...base, count: 3 })
    advance(999)
    assert.ok(grants.consume("CERT"), "live one millisecond before expiry")
    advance(1)
    assert.equal(grants.consume("CERT"), null)
  })

  it("keeps grants for the same certificate from different sites apart", () => {
    const { grants } = setup()
    grants.grant({ ...base, origin: "https://a.example", count: 1 })
    grants.grant({ ...base, origin: "https://b.example", count: 1 })
    const first = grants.consume("CERT")
    const second = grants.consume("CERT")
    assert.deepEqual([first?.origin, second?.origin].sort(), [
      "https://a.example",
      "https://b.example"
    ])
    assert.equal(grants.consume("CERT"), null)
  })

  it("uses the earliest-expiring grant first", () => {
    const { grants } = setup()
    grants.grant({
      ...base,
      origin: "https://late.example",
      ttlMs: 5000,
      count: 1
    })
    grants.grant({
      ...base,
      origin: "https://soon.example",
      ttlMs: 1000,
      count: 1
    })
    assert.equal(grants.consume("CERT")?.origin, "https://soon.example")
  })

  it("grants nothing for a count of zero", () => {
    const { grants } = setup()
    grants.grant({ ...base, count: 0 })
    assert.equal(grants.consume("CERT"), null)
  })

  it("hands back the context the grant was issued with", () => {
    let now = 0
    const grants = new SigningGrants<{ call: string }>(() => now)
    grants.grant({ ...base, count: 1, context: { call: "transfer" } })
    grants.grant({
      ...base,
      certificate: "OTHER",
      count: 1,
      context: { call: "read" }
    })
    assert.deepEqual(grants.consume("OTHER")?.context, { call: "read" })
    assert.deepEqual(grants.consume("CERT")?.context, { call: "transfer" })
  })

  describe("live and use", () => {
    it("lists a certificate's live grants, earliest-expiring first", () => {
      const { grants } = setup()
      grants.grant({
        ...base,
        origin: "https://late.example",
        ttlMs: 5000,
        count: 1
      })
      grants.grant({
        ...base,
        origin: "https://soon.example",
        ttlMs: 1000,
        count: 1
      })
      grants.grant({ ...base, certificate: "OTHER", count: 1 })
      assert.deepEqual(
        grants.live("CERT").map((grant) => grant.origin),
        ["https://soon.example", "https://late.example"]
      )
    })

    it("leaves out grants that are spent or expired", () => {
      const { grants, advance } = setup()
      grants.grant({ ...base, origin: "https://spent.example", count: 1 })
      grants.grant({
        ...base,
        origin: "https://old.example",
        ttlMs: 10,
        count: 1
      })
      grants.grant({ ...base, origin: "https://fresh.example", count: 1 })
      const spent = grants
        .live("CERT")
        .find((grant) => grant.origin === "https://spent.example")!
      grants.use(spent)
      advance(11)
      assert.deepEqual(
        grants.live("CERT").map((grant) => grant.origin),
        ["https://fresh.example"]
      )
    })

    it("spends only the grant it is given", () => {
      const { grants } = setup()
      grants.grant({ ...base, origin: "https://a.example", count: 1 })
      grants.grant({
        ...base,
        origin: "https://b.example",
        ttlMs: 2000,
        count: 1
      })
      const [first, second] = grants.live("CERT")
      grants.use(second)
      assert.deepEqual(
        grants.live("CERT").map((grant) => grant.origin),
        ["https://a.example"]
      )
      assert.equal(first.origin, "https://a.example")
    })
  })
})
