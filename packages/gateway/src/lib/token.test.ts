import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tokenFromUrl, tokenMatches } from "./token";

describe("tokenMatches", () => {
  it("accepts the expected token", () => {
    assert.equal(tokenMatches("s3cret", "s3cret"), true);
  });
  it("rejects a different token, including one that is a prefix", () => {
    assert.equal(tokenMatches("s3cre", "s3cret"), false);
    assert.equal(tokenMatches("s3cret!", "s3cret"), false);
  });
  it("rejects a missing token", () => {
    assert.equal(tokenMatches(null, "s3cret"), false);
  });
});

describe("tokenFromUrl", () => {
  it("reads the token parameter", () => {
    assert.equal(tokenFromUrl("/?token=abc"), "abc");
  });
  it("decodes the value", () => {
    assert.equal(tokenFromUrl("/?token=a%2Bb%20c"), "a+b c");
  });
  it("is null without the parameter", () => {
    assert.equal(tokenFromUrl("/"), null);
    assert.equal(tokenFromUrl(undefined), null);
  });
});
