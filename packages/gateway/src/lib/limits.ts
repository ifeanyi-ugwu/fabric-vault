import type { IncomingMessage } from "node:http";

export interface GatewayLimits {
  /** Simultaneous WebSocket connections from one client address. */
  maxConnectionsPerClient: number;
  /** Largest accepted WebSocket message, in bytes. */
  maxPayloadBytes: number;
  /** Sustained messages per second from one connection. */
  messagesPerSecond: number;
  /** Messages a connection may send at once before the sustained rate applies. */
  messageBurst: number;
  /** Requests accepted in one JSON-RPC batch. */
  maxBatchSize: number;
  /** Requests in flight on one connection. */
  maxConcurrentRequests: number;
  /** Open subscriptions on one connection. */
  maxSubscriptions: number;
  /** A connection that sends nothing for this long is closed. */
  firstMessageTimeoutMs: number;
  /** Interval between liveness pings; a connection that misses one is dropped. */
  pingIntervalMs: number;
  /** Use the first X-Forwarded-For entry as the client address. */
  trustProxy: boolean;
}

function intFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function loadLimits(): GatewayLimits {
  return {
    maxConnectionsPerClient: intFromEnv("GATEWAY_MAX_CONNECTIONS_PER_IP", 20),
    maxPayloadBytes: intFromEnv("GATEWAY_MAX_PAYLOAD_BYTES", 1024 * 1024),
    messagesPerSecond: intFromEnv("GATEWAY_MESSAGES_PER_SECOND", 20),
    messageBurst: intFromEnv("GATEWAY_MESSAGE_BURST", 40),
    maxBatchSize: intFromEnv("GATEWAY_MAX_BATCH_SIZE", 20),
    maxConcurrentRequests: intFromEnv("GATEWAY_MAX_CONCURRENT_REQUESTS", 32),
    maxSubscriptions: intFromEnv("GATEWAY_MAX_SUBSCRIPTIONS", 10),
    firstMessageTimeoutMs: intFromEnv("GATEWAY_FIRST_MESSAGE_TIMEOUT_MS", 30_000),
    pingIntervalMs: intFromEnv("GATEWAY_PING_INTERVAL_MS", 30_000),
    trustProxy: process.env.GATEWAY_TRUST_PROXY === "true",
  };
}

/** Counts live connections per client address. */
export class ConnectionLimiter {
  private counts = new Map<string, number>();

  constructor(private max: number) {}

  /** Returns the release function, or null when the client is at its limit. */
  acquire(client: string): (() => void) | null {
    const current = this.counts.get(client) ?? 0;
    if (current >= this.max) return null;
    this.counts.set(client, current + 1);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const remaining = (this.counts.get(client) ?? 1) - 1;
      if (remaining <= 0) this.counts.delete(client);
      else this.counts.set(client, remaining);
    };
  }
}

/** Token bucket: `burst` messages at once, refilled at `perSecond`. */
export class RateLimiter {
  private tokens: number;
  private last: number;

  constructor(
    private perSecond: number,
    private burst: number,
    private now: () => number = Date.now
  ) {
    this.tokens = burst;
    this.last = now();
  }

  take(): boolean {
    const current = this.now();
    const elapsedSeconds = Math.max(0, current - this.last) / 1000;
    this.last = current;
    this.tokens = Math.min(this.burst, this.tokens + elapsedSeconds * this.perSecond);
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/**
 * The address limits are keyed on. X-Forwarded-For is client-controlled
 * unless a trusted proxy overwrites it, so it is read only when asked for.
 */
export function clientAddress(
  req: Pick<IncomingMessage, "headers" | "socket">,
  trustProxy: boolean
): string {
  if (trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(",")[0]
      ?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? "unknown";
}
