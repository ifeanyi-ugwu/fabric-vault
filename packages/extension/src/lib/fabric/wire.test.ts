import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  bytesField,
  decode,
  DecodeError,
  hasField,
  intField,
  repeatedBytes,
  textField
} from "./wire"

const bytes = (...values: number[]) => Uint8Array.from(values)
// tag = field << 3 | wire type
const lengthDelimited = (field: number, ...payload: number[]) =>
  bytes((field << 3) | 2, payload.length, ...payload)
const varint = (field: number, ...encoded: number[]) =>
  bytes((field << 3) | 0, ...encoded)
const concat = (...parts: Uint8Array[]) =>
  Uint8Array.from(parts.flatMap((part) => [...part]))

describe("decode", () => {
  it("reads a length-delimited field", () => {
    const message = decode(lengthDelimited(1, 104, 105))
    assert.equal(textField(message, 1), "hi")
  })

  it("reads a single-byte varint", () => {
    assert.equal(intField(decode(varint(1, 5)), 1), 5)
  })

  it("reads a multi-byte varint", () => {
    // 300 = 0b1_0010_1100 -> 0xac 0x02
    assert.equal(intField(decode(varint(1, 0xac, 0x02)), 1), 300)
  })

  it("reads a field number above 15 from a two-byte tag", () => {
    // field 16, wire type 2 -> tag 130 -> 0x82 0x01
    const message = decode(bytes(0x82, 0x01, 1, 65))
    assert.equal(textField(message, 16), "A")
  })

  it("keeps every occurrence of a repeated field in order", () => {
    const message = decode(
      concat(lengthDelimited(1, 97), lengthDelimited(1, 98), lengthDelimited(1))
    )
    assert.deepEqual(
      repeatedBytes(message, 1).map((value) => value.length),
      [1, 1, 0]
    )
  })

  it("reads an absent field as empty or zero", () => {
    const message = decode(new Uint8Array(0))
    assert.equal(textField(message, 1), "")
    assert.equal(intField(message, 1), 0)
    assert.equal(hasField(message, 1), false)
  })

  it("ignores a field the caller does not read", () => {
    const message = decode(concat(varint(9, 1), lengthDelimited(1, 97)))
    assert.equal(textField(message, 1), "a")
  })

  it("accepts an empty length-delimited field as present", () => {
    assert.equal(hasField(decode(lengthDelimited(2)), 2), true)
  })

  const rejected: Array<[string, Uint8Array]> = [
    ["a field that runs past the end", bytes((1 << 3) | 2, 5, 97)],
    ["a length with no bytes after it", bytes((1 << 3) | 2)],
    ["a truncated varint", bytes((1 << 3) | 0, 0x80)],
    ["a varint over five bytes", bytes(8, 0x80, 0x80, 0x80, 0x80, 0x80, 0x01)],
    ["a fixed64 field", bytes((1 << 3) | 1, 0, 0, 0, 0, 0, 0, 0, 0)],
    ["a fixed32 field", bytes((1 << 3) | 5, 0, 0, 0, 0)],
    ["a group start", bytes((1 << 3) | 3)],
    ["field number zero", bytes(0 | 2, 0)]
  ]
  for (const [name, input] of rejected) {
    it(`rejects ${name}`, () => {
      assert.throws(() => decode(input), DecodeError)
    })
  }
})

describe("single-valued fields", () => {
  const twice = decode(concat(lengthDelimited(1, 97), lengthDelimited(1, 98)))

  it("rejects a bytes field that appears twice", () => {
    assert.throws(() => bytesField(twice, 1), /appears 2 times/)
  })

  it("rejects a text field that appears twice", () => {
    assert.throws(() => textField(twice, 1), DecodeError)
  })

  it("rejects an integer field that appears twice", () => {
    const message = decode(concat(varint(1, 1), varint(1, 2)))
    assert.throws(() => intField(message, 1), DecodeError)
  })

  it("does not reject duplicates of a field nobody reads", () => {
    const message = decode(
      concat(varint(7, 1), varint(7, 2), lengthDelimited(1, 97))
    )
    assert.equal(textField(message, 1), "a")
  })

  it("rejects a varint read as bytes and bytes read as a varint", () => {
    assert.throws(() => bytesField(decode(varint(1, 1)), 1), DecodeError)
    assert.throws(() => intField(decode(lengthDelimited(1, 1)), 1), DecodeError)
  })

  it("rejects text that is not valid UTF-8", () => {
    assert.throws(
      () => textField(decode(lengthDelimited(1, 0xff)), 1),
      DecodeError
    )
  })
})
