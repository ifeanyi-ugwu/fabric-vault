import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { PendingRequests, type Timers } from "./pending-requests"

/** Timers that run only when the test says so. */
function fakeTimers() {
  const scheduled = new Map<number, () => void>()
  let next = 0
  const timers: Timers = {
    set: (callback) => {
      scheduled.set(++next, callback)
      return next as unknown as ReturnType<typeof setTimeout>
    },
    clear: (timer) => {
      scheduled.delete(timer as unknown as number)
    }
  }
  return {
    timers,
    pending: () => scheduled.size,
    fireAll: () => [...scheduled.values()].forEach((callback) => callback())
  }
}

function setup() {
  const clock = fakeTimers()
  const settled: string[] = []
  const requests = new PendingRequests({
    timeoutMs: 1000,
    onSettled: (id) => settled.push(id),
    timers: clock.timers
  })
  return { requests, settled, clock }
}

const outcome = (promise: Promise<unknown>) =>
  promise.then(
    (value) => ({ value }),
    (error: Error) => ({ error: error.message })
  )

describe("PendingRequests", () => {
  it("resolves the promise with the value", async () => {
    const { requests } = setup()
    const promise = requests.open("a")
    assert.equal(requests.resolve("a", 42), true)
    assert.deepEqual(await outcome(promise), { value: 42 })
  })

  it("rejects the promise with the error", async () => {
    const { requests } = setup()
    const promise = requests.open("a")
    assert.equal(requests.reject("a", new Error("no")), true)
    assert.deepEqual(await outcome(promise), { error: "no" })
  })

  it("reports false for an id that is not open", () => {
    const { requests } = setup()
    assert.equal(requests.resolve("x", 1), false)
    assert.equal(requests.reject("x", new Error("no")), false)
    assert.equal(requests.has("x"), false)
  })

  it("settles a request once: a second answer finds nothing", () => {
    const { requests, settled } = setup()
    void requests.open("a")
    assert.equal(requests.resolve("a", 1), true)
    assert.equal(requests.resolve("a", 2), false)
    assert.deepEqual(settled, ["a"])
  })

  it("keeps requests with different ids apart", async () => {
    const { requests } = setup()
    const first = requests.open("a")
    const second = requests.open("b")
    requests.resolve("b", "second")
    requests.resolve("a", "first")
    assert.deepEqual(await outcome(first), { value: "first" })
    assert.deepEqual(await outcome(second), { value: "second" })
  })

  it("refuses an id that is already open, and leaves the first request alone", async () => {
    const { requests } = setup()
    const first = requests.open("a")
    // A request that was wrongly accepted never settles; the race turns that
    // into a failure instead of a hang.
    const second = await Promise.race([
      outcome(requests.open("a")),
      new Promise((resolve) => setImmediate(() => resolve("accepted")))
    ])
    assert.deepEqual(second, {
      error: "A request with this id is already open."
    })
    requests.resolve("a", "ok")
    assert.deepEqual(await outcome(first), { value: "ok" })
  })

  describe("closing the popup", () => {
    it("rejects a request that was not answered", async () => {
      const { requests, settled } = setup()
      const promise = requests.open("a")
      requests.popupClosed("a")
      assert.deepEqual(await outcome(promise), {
        error: "The request was closed without an answer."
      })
      assert.deepEqual(settled, ["a"])
    })

    it("leaves an answered request running", async () => {
      const { requests, settled } = setup()
      const promise = requests.open("a")
      requests.answered("a")
      requests.popupClosed("a")
      assert.equal(requests.has("a"), true)
      assert.deepEqual(settled, [])
      requests.resolve("a", "result")
      assert.deepEqual(await outcome(promise), { value: "result" })
    })

    it("ignores a request that is not open", () => {
      const { requests, settled } = setup()
      requests.popupClosed("x")
      assert.deepEqual(settled, [])
    })
  })

  describe("the timeout", () => {
    it("rejects a request nobody answered", async () => {
      const { requests, settled, clock } = setup()
      const promise = requests.open("a")
      clock.fireAll()
      assert.deepEqual(await outcome(promise), {
        error: "The request timed out."
      })
      assert.deepEqual(settled, ["a"])
    })

    it("stops once the user has answered", () => {
      const { requests, clock } = setup()
      void requests.open("a")
      requests.answered("a")
      assert.equal(clock.pending(), 0)
    })

    it("is cleared when the request settles", () => {
      const { requests, clock } = setup()
      void requests.open("a")
      assert.equal(clock.pending(), 1)
      requests.resolve("a", 1)
      assert.equal(clock.pending(), 0)
    })
  })

  describe("forget", () => {
    it("removes the request and runs onSettled without settling the promise", async () => {
      const { requests, settled, clock } = setup()
      let done = false
      void requests.open("a").then(
        () => (done = true),
        () => (done = true)
      )
      requests.forget("a")
      await Promise.resolve()
      assert.equal(requests.has("a"), false)
      assert.deepEqual(settled, ["a"])
      assert.equal(clock.pending(), 0)
      assert.equal(done, false)
    })
  })

  describe("with the real timers", () => {
    it("works where setTimeout must be called as a plain function", async () => {
      // A browser throws "Illegal invocation" for setTimeout called as a
      // method of another object. This makes Node do the same.
      const original = globalThis.setTimeout
      const strict = function (
        this: unknown,
        ...args: Parameters<typeof setTimeout>
      ) {
        if (this !== undefined && this !== globalThis) {
          throw new TypeError("Illegal invocation")
        }
        return original(...args)
      } as typeof setTimeout
      globalThis.setTimeout = strict
      try {
        const requests = new PendingRequests({
          timeoutMs: 1000,
          onSettled: () => {}
        })
        const promise = requests.open("a")
        requests.resolve("a", "ok")
        assert.deepEqual(await outcome(promise), { value: "ok" })
      } finally {
        globalThis.setTimeout = original
      }
    })
  })
})
