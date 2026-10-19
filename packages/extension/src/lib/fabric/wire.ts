export class DecodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DecodeError"
  }
}

type Value = number | Uint8Array

/** The fields of one protobuf message: field number to every value seen. */
export type Message = Map<number, Value[]>

const MAX_VARINT_BYTES = 5

/**
 * Reads the top level of a protobuf message. Only varint and
 * length-delimited fields occur in the Fabric messages this reads; any other
 * wire type is rejected, as is input that ends inside a field. Embedded
 * messages are decoded by calling `decode` again on their bytes.
 */
export function decode(buf: Uint8Array): Message {
  const fields: Message = new Map()
  let pos = 0

  const varint = (): number => {
    let result = 0
    for (let i = 0; i < MAX_VARINT_BYTES; i++) {
      if (pos >= buf.length) throw new DecodeError("input ends inside a varint")
      const byte = buf[pos++]
      result += (byte & 0x7f) * 2 ** (7 * i)
      if (!(byte & 0x80)) return result
    }
    throw new DecodeError("varint longer than 5 bytes")
  }

  while (pos < buf.length) {
    const tag = varint()
    const field = Math.floor(tag / 8)
    const wireType = tag % 8
    if (field === 0) throw new DecodeError("field number 0")

    let value: Value
    if (wireType === 0) {
      value = varint()
    } else if (wireType === 2) {
      const length = varint()
      if (pos + length > buf.length) {
        throw new DecodeError(`field ${field} runs past the end of its message`)
      }
      value = buf.subarray(pos, pos + length)
      pos += length
    } else {
      throw new DecodeError(
        `field ${field} has unsupported wire type ${wireType}`
      )
    }

    const seen = fields.get(field)
    if (seen) seen.push(value)
    else fields.set(field, [value])
  }
  return fields
}

/**
 * The value of a field the schema allows once. A protobuf reader keeps the
 * last of several, so a second occurrence is how one party could be shown a
 * different value than another; it is rejected instead.
 */
function single(message: Message, field: number): Value | undefined {
  const values = message.get(field)
  if (values && values.length > 1) {
    throw new DecodeError(`field ${field} appears ${values.length} times`)
  }
  return values?.[0]
}

/** A `bytes`, `string` or embedded-message field. Absent reads as empty. */
export function bytesField(message: Message, field: number): Uint8Array {
  const value = single(message, field)
  if (value === undefined) return new Uint8Array(0)
  if (typeof value === "number") {
    throw new DecodeError(`field ${field} is a varint, expected bytes`)
  }
  return value
}

export function textField(message: Message, field: number): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      bytesField(message, field)
    )
  } catch (error) {
    if (error instanceof DecodeError) throw error
    throw new DecodeError(`field ${field} is not valid UTF-8`)
  }
}

export function intField(message: Message, field: number): number {
  const value = single(message, field)
  if (value === undefined) return 0
  if (typeof value !== "number") {
    throw new DecodeError(
      `field ${field} is length-delimited, expected a varint`
    )
  }
  return value
}

export function hasField(message: Message, field: number): boolean {
  return message.has(field)
}

/** Every occurrence of a `repeated bytes` field, in order. */
export function repeatedBytes(message: Message, field: number): Uint8Array[] {
  return (message.get(field) ?? []).map((value) => {
    if (typeof value === "number") {
      throw new DecodeError(`field ${field} is a varint, expected bytes`)
    }
    return value
  })
}

/** An embedded message field. Absent reads as an empty message. */
export function messageField(message: Message, field: number): Message {
  return decode(bytesField(message, field))
}
