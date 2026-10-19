import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { getPortOrigin } from "./origin"

const port = (url?: string) => ({ sender: url ? { url } : undefined })

describe("getPortOrigin", () => {
  it("drops the path, query and fragment", () => {
    assert.equal(
      getPortOrigin(port("https://dapp.example.com/app?x=1#top")),
      "https://dapp.example.com"
    )
  })
  it("keeps a non-default port", () => {
    assert.equal(
      getPortOrigin(port("http://localhost:3000/")),
      "http://localhost:3000"
    )
  })
  it("is undefined without a sender", () => {
    assert.equal(getPortOrigin(port()), undefined)
  })
  it("is undefined for an unparseable url", () => {
    assert.equal(getPortOrigin(port("not a url")), undefined)
  })
})
