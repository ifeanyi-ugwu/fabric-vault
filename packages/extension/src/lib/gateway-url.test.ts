import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { assertSecureGatewayUrl, isSecureGatewayUrl } from "./gateway-url"

describe("isSecureGatewayUrl", () => {
  const accepted = [
    "wss://gateway.example.com",
    "wss://gateway.example.com:8443/rpc",
    "ws://localhost:7545",
    "ws://127.0.0.1:7545",
    "ws://[::1]:7545"
  ]
  const refused = [
    "ws://gateway.example.com",
    "ws://192.168.1.20:7545",
    "ws://localhost.example.com:7545",
    "ws://127.0.0.1.example.com",
    "http://localhost:7545",
    "https://gateway.example.com",
    "gateway.example.com",
    ""
  ]
  for (const url of accepted) {
    it(`accepts ${url}`, () => assert.equal(isSecureGatewayUrl(url), true))
  }
  for (const url of refused) {
    it(`refuses ${JSON.stringify(url)}`, () =>
      assert.equal(isSecureGatewayUrl(url), false))
  }
})

describe("assertSecureGatewayUrl", () => {
  it("names the url and the rule in its error", () => {
    assert.throws(
      () => assertSecureGatewayUrl("ws://gateway.example.com"),
      /ws:\/\/gateway\.example\.com must use wss/
    )
  })
})
