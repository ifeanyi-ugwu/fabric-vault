import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildGatewayParams } from "./request-params"

const identity = { mspId: "Org1MSP", certificate: "USER-CERT" }
const peer = {
  name: "peer0",
  endpoint: "peer0.org1.example.com:7051",
  tlsRootCert: "ROOT"
}

describe("buildGatewayParams", () => {
  it("keeps the dApp's call parameters", () => {
    const params = buildGatewayParams(
      { channel: "mychannel", chaincode: "basic", fn: "Transfer", args: ["a"] },
      identity,
      peer
    )
    assert.equal(params.channel, "mychannel")
    assert.equal(params.fn, "Transfer")
    assert.deepEqual(params.args, ["a"])
  })

  it("uses the extension's peer when the dApp supplies one", () => {
    const params = buildGatewayParams(
      { peer: { name: "evil", endpoint: "attacker.example.com:7051" } },
      identity,
      peer
    )
    assert.deepEqual(params.peer, peer)
  })

  it("uses the extension's identity when the dApp supplies one", () => {
    const params = buildGatewayParams(
      { identity: { mspId: "Other", certificate: "OTHER-CERT" } },
      identity,
      peer
    )
    assert.deepEqual(params.identity, identity)
  })

  it("drops identity fields beyond mspId and certificate", () => {
    const params = buildGatewayParams(
      {},
      { ...identity, label: "alice" } as any,
      peer
    )
    assert.deepEqual(params.identity, identity)
  })

  it("accepts a request with no dApp params", () => {
    assert.deepEqual(buildGatewayParams(undefined, identity, peer), {
      identity,
      peer
    })
  })
})
