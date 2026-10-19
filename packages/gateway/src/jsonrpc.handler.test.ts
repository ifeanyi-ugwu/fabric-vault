import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it, mock } from "node:test";
import { JsonRpcHandler } from "./jsonrpc.handler";

class FakeSocket extends EventEmitter {
  sent: any[] = [];
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
}

const TIMEOUT_MS = 1000;

function setup() {
  const ws = new FakeSocket();
  const sign = new JsonRpcHandler(ws as any, TIMEOUT_MS).createSigner("CERT");
  const request = () => ws.sent[ws.sent.length - 1];
  const reply = (payload: object) =>
    ws.emit("message", Buffer.from(JSON.stringify({ jsonrpc: "2.0", ...payload })));
  return { ws, sign, request, reply };
}

const listeners = (ws: FakeSocket) =>
  ws.listenerCount("message") + ws.listenerCount("close");

describe("signature request", () => {
  it("asks the client to sign the base64 digest for the certificate", () => {
    const { sign, request } = setup();
    void sign(Uint8Array.from([1, 2, 3])).catch(() => {});
    assert.equal(request().method, "signDigest");
    assert.deepEqual(request().params, { digest: "AQID", certificate: "CERT" });
  });

  it("resolves with the decoded signature from the matching reply", async () => {
    const { sign, request, reply } = setup();
    const pending = sign(Uint8Array.from([9]));
    reply({ id: request().id, result: { signature: "BAUG" } });
    assert.deepEqual(await pending, Uint8Array.from([4, 5, 6]));
  });

  it("keeps waiting through unrelated and unparseable messages", async () => {
    const { ws, sign, request, reply } = setup();
    const pending = sign(Uint8Array.from([9]));
    ws.emit("message", Buffer.from("not json"));
    reply({ id: "someone-else", result: { signature: "AAAA" } });
    reply({ id: request().id, result: { signature: "BAUG" } });
    assert.deepEqual(await pending, Uint8Array.from([4, 5, 6]));
  });

  it("rejects with the client's message on an error reply", async () => {
    const { sign, request, reply } = setup();
    const pending = sign(Uint8Array.from([9]));
    reply({ id: request().id, error: { code: -32001, message: "Signing failed" } });
    await assert.rejects(pending, /Signing failed/);
  });

  it("rejects when the socket closes before a reply", async () => {
    const { ws, sign } = setup();
    const pending = sign(Uint8Array.from([9]));
    ws.emit("close");
    await assert.rejects(pending, /closed before a signature/);
  });

  it("rejects after the timeout", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { sign } = setup();
    const pending = sign(Uint8Array.from([9]));
    t.mock.timers.tick(TIMEOUT_MS);
    await assert.rejects(pending, /timed out after 1000ms/);
  });

  for (const outcome of ["reply", "error reply", "close", "timeout"]) {
    it(`removes its listeners after a ${outcome}`, async (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const { ws, sign, request, reply } = setup();
      const pending = sign(Uint8Array.from([9])).catch(() => {});
      assert.equal(listeners(ws), 2, "listeners attached while pending");
      if (outcome === "reply") reply({ id: request().id, result: { signature: "BAUG" } });
      if (outcome === "error reply") reply({ id: request().id, error: { message: "no" } });
      if (outcome === "close") ws.emit("close");
      if (outcome === "timeout") t.mock.timers.tick(TIMEOUT_MS);
      await pending;
      assert.equal(listeners(ws), 0);
    });
  }
});
