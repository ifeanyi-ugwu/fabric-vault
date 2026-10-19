import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { afterEach, describe, it } from "node:test";
import { createApp } from "./app";
import type { GatewayLimits } from "./lib/limits";

const servers: Array<import("node:http").Server> = [];
const sockets: WebSocket[] = [];

async function start(limits: Partial<GatewayLimits>) {
  const { server } = createApp(limits);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  return `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

// Upgraded connections are not tracked by closeAllConnections(), so the
// clients close first or server.close() waits on the gateway's own timers.
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.close();
  for (const server of servers.splice(0)) {
    await new Promise((resolve) => server.close(resolve));
  }
});

/** Resolves with the close code once the connection has opened and closed. */
function closeCode(socket: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    socket.onclose = (event) => resolve(event.code);
  });
}

function opened(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    sockets.push(socket);
    socket.onopen = () => resolve(socket);
    socket.onerror = () => reject(new Error("connect failed"));
  });
}

function nextMessage(socket: WebSocket): Promise<any> {
  return new Promise((resolve) => {
    socket.onmessage = (event) => resolve(JSON.parse(String(event.data)));
  });
}

describe("gateway limits", () => {
  it("closes a connection beyond the per-client limit", async () => {
    const url = await start({ maxConnectionsPerClient: 2 });
    await opened(url);
    await opened(url);
    const third = new WebSocket(url);
    assert.equal(await closeCode(third), 1013);
  });

  it("frees the slot when a connection closes", async () => {
    const url = await start({ maxConnectionsPerClient: 1 });
    const first = await opened(url);
    const closed = closeCode(first);
    first.close();
    await closed;
    // A refused connection still completes the handshake, so only a reply
    // shows that this one was accepted.
    const second = await opened(url);
    const reply = nextMessage(second);
    second.send("not json");
    assert.equal((await reply).error.code, -32700);
  });

  it("closes a message above the payload limit", async () => {
    const url = await start({ maxPayloadBytes: 1024 });
    const socket = await opened(url);
    const closed = closeCode(socket);
    socket.send("x".repeat(2048));
    assert.equal(await closed, 1009);
  });

  it("closes a connection that sends nothing", async () => {
    const url = await start({ firstMessageTimeoutMs: 50 });
    const socket = await opened(url);
    assert.equal(await closeCode(socket), 1008);
  });

  it("keeps a connection that has sent a message", async () => {
    const url = await start({ firstMessageTimeoutMs: 100 });
    const socket = await opened(url);
    const reply = nextMessage(socket);
    socket.send("not json");
    await reply;
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(socket.readyState, WebSocket.OPEN);
  });

  it("closes a connection that exceeds its message rate", async () => {
    const url = await start({ messageBurst: 3, messagesPerSecond: 1 });
    const socket = await opened(url);
    const closed = closeCode(socket);
    for (let i = 0; i < 10; i++) socket.send("{}");
    assert.equal(await closed, 1008);
  });

  it("rejects a batch above the size limit", async () => {
    const url = await start({ maxBatchSize: 2 });
    const socket = await opened(url);
    const reply = nextMessage(socket);
    socket.send(JSON.stringify([{}, {}, {}]));
    const response = await reply;
    assert.equal(response.error.code, -32600);
    assert.match(response.error.message, /Batch too large/);
    socket.close();
  });

  it("serves a connection within every limit", async () => {
    const url = await start({});
    const socket = await opened(url);
    const reply = nextMessage(socket);
    socket.send("not json");
    assert.equal((await reply).error.code, -32700);
    socket.close();
  });
});
