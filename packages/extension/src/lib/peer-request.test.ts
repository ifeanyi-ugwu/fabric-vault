import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  applyPeerRequest,
  parsePeerRequest,
  PeerRequestError,
  samePeer,
  type StoredPeer
} from "./peer-request"

const CERT =
  "-----BEGIN CERTIFICATE-----\nMIIBszCCAVmgAwIBAgIUQ0=\n-----END CERTIFICATE-----\n"

const valid = {
  name: "peer0.org1.example.com",
  endpoint: "peer0.org1.example.com:7051",
  rpcUrl: "wss://gateway.example.com"
}

describe("parsePeerRequest", () => {
  it("reads a peer with no certificate", () => {
    assert.deepEqual(parsePeerRequest(valid), { ...valid, tlsRootCert: null })
  })

  it("reads a peer with a PEM certificate", () => {
    assert.equal(
      parsePeerRequest({ ...valid, tlsRootCert: CERT }).tlsRootCert,
      CERT
    )
  })

  it("accepts a loopback gateway over ws://", () => {
    assert.equal(
      parsePeerRequest({ ...valid, rpcUrl: "ws://localhost:7545" }).rpcUrl,
      "ws://localhost:7545"
    )
  })

  it("accepts an IPv4 and a bracketed IPv6 endpoint", () => {
    assert.equal(
      parsePeerRequest({ ...valid, endpoint: "10.0.0.5:7051" }).endpoint,
      "10.0.0.5:7051"
    )
    assert.equal(
      parsePeerRequest({ ...valid, endpoint: "[::1]:7051" }).endpoint,
      "[::1]:7051"
    )
  })

  it("trims the fields it reads", () => {
    const parsed = parsePeerRequest({
      name: "  p  ",
      endpoint: " a.example:7051 ",
      rpcUrl: " wss://g.example "
    })
    assert.deepEqual(
      [parsed.name, parsed.endpoint, parsed.rpcUrl],
      ["p", "a.example:7051", "wss://g.example"]
    )
  })

  it("drops fields it does not read, including legacySigning and id", () => {
    const parsed = parsePeerRequest({
      ...valid,
      legacySigning: true,
      id: "x",
      extra: 1
    })
    assert.deepEqual(Object.keys(parsed).sort(), [
      "endpoint",
      "name",
      "rpcUrl",
      "tlsRootCert"
    ])
  })

  const rejected: Array<[string, unknown, RegExp]> = [
    ["no params", undefined, /no peer/],
    ["a list", [], /no peer/],
    ["no name", { ...valid, name: "" }, /no name/],
    ["a blank name", { ...valid, name: "   " }, /no name/],
    ["a name that is not text", { ...valid, name: 3 }, /no name/],
    [
      "a name that is too long",
      { ...valid, name: "n".repeat(101) },
      /too long/
    ],
    ["no endpoint", { ...valid, endpoint: undefined }, /host:port/],
    [
      "an endpoint with a scheme",
      { ...valid, endpoint: "dns:///peer.example:7051" },
      /host:port/
    ],
    [
      "an endpoint with a path",
      { ...valid, endpoint: "peer.example:7051/x" },
      /host:port/
    ],
    [
      "an endpoint without a port",
      { ...valid, endpoint: "peer.example" },
      /host:port/
    ],
    ["port zero", { ...valid, endpoint: "peer.example:0" }, /host:port/],
    [
      "a port above 65535",
      { ...valid, endpoint: "peer.example:70000" },
      /host:port/
    ],
    [
      "a remote ws:// gateway",
      { ...valid, rpcUrl: "ws://gateway.example.com" },
      /wss/
    ],
    [
      "an http gateway",
      { ...valid, rpcUrl: "https://gateway.example.com" },
      /wss/
    ],
    ["no gateway", { ...valid, rpcUrl: undefined }, /wss/],
    [
      "a certificate that is not PEM",
      { ...valid, tlsRootCert: "hello" },
      /PEM/
    ],
    [
      "a private key",
      {
        ...valid,
        tlsRootCert:
          "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----"
      },
      /PEM/
    ],
    ["a certificate that is not text", { ...valid, tlsRootCert: 5 }, /PEM/],
    [
      "an oversized certificate",
      {
        ...valid,
        tlsRootCert: `-----BEGIN CERTIFICATE-----\n${"A".repeat(20_001)}\n-----END CERTIFICATE-----`
      },
      /PEM/
    ]
  ]
  for (const [name, params, pattern] of rejected) {
    it(`rejects ${name}`, () => {
      assert.throws(
        () => parsePeerRequest(params),
        (error: Error) => {
          assert.ok(error instanceof PeerRequestError)
          assert.match(error.message, pattern)
          return true
        }
      )
    })
  }
})

describe("samePeer", () => {
  const base = { ...valid, tlsRootCert: null }
  it("matches the same node through the same gateway", () => {
    assert.equal(samePeer(base, { ...base, name: "renamed" }), true)
  })
  it("ignores trailing newlines and line endings in the certificate", () => {
    const pem =
      "-----BEGIN CERTIFICATE-----\nAAAA\nBBBB\n-----END CERTIFICATE-----"
    assert.equal(
      samePeer(
        { ...base, tlsRootCert: `${pem}\n` },
        { ...base, tlsRootCert: pem }
      ),
      true
    )
    assert.equal(
      samePeer(
        { ...base, tlsRootCert: pem },
        { ...base, tlsRootCert: pem.replace(/\n/g, "\r\n") }
      ),
      true
    )
  })

  it("tells a certificate from none, and one certificate from another", () => {
    assert.equal(samePeer({ ...base, tlsRootCert: CERT }, base), false)
    assert.equal(
      samePeer(
        { ...base, tlsRootCert: CERT },
        { ...base, tlsRootCert: CERT.replace("MIIB", "MIIC") }
      ),
      false
    )
  })

  it("tells apart another endpoint, gateway or certificate", () => {
    assert.equal(samePeer(base, { ...base, endpoint: "other:7051" }), false)
    assert.equal(
      samePeer(base, { ...base, rpcUrl: "wss://other.example" }),
      false
    )
    assert.equal(samePeer(base, { ...base, tlsRootCert: CERT }), false)
  })
})

describe("applyPeerRequest", () => {
  const request = { ...valid, tlsRootCert: null }
  const stored: StoredPeer = {
    id: "p1",
    ...request,
    name: "My name",
    legacySigning: true
  }

  it("adds an unknown peer with legacy signing off and selects it", () => {
    const result = applyPeerRequest([], request, "new-id")
    assert.equal(result.added, true)
    assert.deepEqual(result.selected, {
      id: "new-id",
      ...request,
      legacySigning: false
    })
    assert.deepEqual(result.peers, [result.selected])
  })

  it("keeps the existing peers when it adds one", () => {
    const other: StoredPeer = { id: "p0", ...request, endpoint: "x:1" }
    const result = applyPeerRequest([other], request, "new-id")
    assert.deepEqual(
      result.peers.map((p) => p.id),
      ["p0", "new-id"]
    )
  })

  it("selects a known peer without changing it, legacy signing included", () => {
    const result = applyPeerRequest([stored], request, "unused")
    assert.equal(result.added, false)
    assert.equal(result.selected, stored)
    assert.deepEqual(result.peers, [stored])
    assert.equal(result.selected.legacySigning, true)
    assert.equal(result.selected.name, "My name")
  })

  it("does not take legacy signing from the request", () => {
    const sneaky = parsePeerRequest({ ...valid, legacySigning: true })
    assert.equal(
      applyPeerRequest([], sneaky, "id").selected.legacySigning,
      false
    )
  })
})
