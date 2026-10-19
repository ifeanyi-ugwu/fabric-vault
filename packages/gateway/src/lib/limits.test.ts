import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientAddress, ConnectionLimiter, RateLimiter } from "./limits";

describe("ConnectionLimiter", () => {
  it("refuses a client at its limit", () => {
    const limiter = new ConnectionLimiter(2);
    assert.ok(limiter.acquire("a"));
    assert.ok(limiter.acquire("a"));
    assert.equal(limiter.acquire("a"), null);
  });

  it("counts each client separately", () => {
    const limiter = new ConnectionLimiter(1);
    assert.ok(limiter.acquire("a"));
    assert.ok(limiter.acquire("b"));
  });

  it("frees a slot on release", () => {
    const limiter = new ConnectionLimiter(1);
    const release = limiter.acquire("a");
    assert.equal(limiter.acquire("a"), null);
    release!();
    assert.ok(limiter.acquire("a"));
  });

  it("ignores a second release of the same slot", () => {
    const limiter = new ConnectionLimiter(2);
    const first = limiter.acquire("a")!;
    limiter.acquire("a");
    first();
    first();
    assert.ok(limiter.acquire("a"), "one slot is free");
    assert.equal(limiter.acquire("a"), null, "a double release freed a second slot");
  });
});

describe("RateLimiter", () => {
  const clock = (start = 0) => {
    let now = start;
    return { now: () => now, advance: (ms: number) => (now += ms) };
  };

  it("allows a burst and then refuses", () => {
    const time = clock();
    const limiter = new RateLimiter(10, 3, time.now);
    assert.deepEqual([limiter.take(), limiter.take(), limiter.take()], [true, true, true]);
    assert.equal(limiter.take(), false);
  });

  it("refills at the sustained rate", () => {
    const time = clock();
    const limiter = new RateLimiter(10, 1, time.now);
    assert.equal(limiter.take(), true);
    assert.equal(limiter.take(), false);
    time.advance(99);
    assert.equal(limiter.take(), false, "99ms is short of one token");
    time.advance(1);
    assert.equal(limiter.take(), true);
  });

  it("does not bank more than the burst", () => {
    const time = clock();
    const limiter = new RateLimiter(10, 2, time.now);
    time.advance(60_000);
    assert.deepEqual([limiter.take(), limiter.take(), limiter.take()], [true, true, false]);
  });
});

describe("clientAddress", () => {
  const request = (forwarded?: string | string[]) =>
    ({
      headers: forwarded === undefined ? {} : { "x-forwarded-for": forwarded },
      socket: { remoteAddress: "203.0.113.7" },
    }) as any;

  it("uses the socket address by default, whatever the header says", () => {
    assert.equal(clientAddress(request("198.51.100.1"), false), "203.0.113.7");
  });

  it("uses the first forwarded address when the proxy is trusted", () => {
    assert.equal(
      clientAddress(request("198.51.100.1, 10.0.0.2"), true),
      "198.51.100.1"
    );
  });

  it("falls back to the socket when the trusted header is absent", () => {
    assert.equal(clientAddress(request(), true), "203.0.113.7");
  });
});
