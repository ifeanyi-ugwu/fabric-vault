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
  const sign = new JsonRpcHandler(ws as any, { signatureTimeoutMs: TIMEOUT_MS }).createSigner("CERT");
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

describe("request signer", () => {
  const setupRequestSigner = () => {
    const ws = new FakeSocket();
    const sign = new JsonRpcHandler(ws as any, {
      signatureTimeoutMs: TIMEOUT_MS,
    }).createRequestSigner("CERT");
    const request = () => ws.sent[ws.sent.length - 1];
    return { ws, sign, request };
  };

  it("asks the client to sign the serialized request of that kind", () => {
    const { sign, request } = setupRequestSigner();
    void sign("transaction", Uint8Array.from([1, 2, 3])).catch(() => {});
    assert.equal(request().method, "signRequest");
    assert.deepEqual(request().params, {
      kind: "transaction",
      bytes: "AQID",
      certificate: "CERT",
    });
  });

  it("sends no digest", () => {
    const { sign, request } = setupRequestSigner();
    void sign("proposal", Uint8Array.from([9])).catch(() => {});
    assert.equal("digest" in request().params, false);
  });

  it("resolves with the decoded signature from the matching reply", async () => {
    const { ws, sign, request } = setupRequestSigner();
    const pending = sign("commit", Uint8Array.from([9]));
    ws.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          jsonrpc: "2.0",
          id: request().id,
          result: { signature: "BAUG" },
        })
      )
    );
    assert.deepEqual(await pending, Uint8Array.from([4, 5, 6]));
  });

  it("rejects with the client's message when it refuses", async () => {
    const { ws, sign, request } = setupRequestSigner();
    const pending = sign("proposal", Uint8Array.from([9]));
    ws.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          jsonrpc: "2.0",
          id: request().id,
          error: { code: -32001, message: "The call is not the approved call." },
        })
      )
    );
    await assert.rejects(pending, /not the approved call/);
  });
});

describe("signing protocol selection", () => {
  const call = (capabilities?: unknown) => ({
    jsonrpc: "2.0",
    id: "1",
    method: "fabric_evaluateTransaction",
    params: {
      identity: { mspId: "Org1MSP", certificate: "CERT" },
      peer: { name: "peer0", endpoint: "peer0.example.com:7051" },
      channel: "mychannel",
      chaincode: "basic",
      fn: "Read",
      args: [],
      ...(capabilities === undefined ? {} : { capabilities }),
    },
  });

  const run = async (...requests: object[]) => {
    const ws = new FakeSocket();
    const signings: string[] = [];
    const handler = new JsonRpcHandler(ws as any, {
      createService: async (_identity, signing) => {
        signings.push("request" in signing ? "request" : "digest");
        return {
          evaluateTransaction: async () => ({ ok: true }),
          close: () => {},
        } as any;
      },
    });
    for (const request of requests) {
      await handler.processMessage(JSON.stringify(request));
    }
    return { signings, replies: ws.sent };
  };

  it("uses signRequest for a client that advertises it", async () => {
    const { signings } = await run(call(["signRequest"]));
    // One service for the connection and one for the call.
    assert.deepEqual(signings, ["request", "request"]);
  });

  it("uses signDigest for a client that advertises nothing", async () => {
    const { signings } = await run(call());
    assert.deepEqual(signings, ["digest", "digest"]);
  });

  it("uses signDigest when the capability list does not include it", async () => {
    const { signings } = await run(call(["somethingElse"]));
    assert.deepEqual(signings, ["digest", "digest"]);
  });

  it("uses signDigest when capabilities is not a list", async () => {
    const { signings } = await run(call("signRequest"));
    assert.deepEqual(signings, ["digest", "digest"]);
  });

  it("keeps the protocol the first request chose", async () => {
    const { signings } = await run(call(), call(["signRequest"]));
    assert.deepEqual(signings, ["digest", "digest", "digest"]);
  });
});

describe("responses", () => {
  const params = {
    identity: { mspId: "Org1MSP", certificate: "CERT" },
    peer: { name: "peer0", endpoint: "peer0.example.com:7051" },
    channel: "mychannel",
    chaincode: "basic",
    fn: "Read",
    args: [],
  };

  const service = {
    evaluateTransaction: async () => ({ balance: 5 }),
    submitTransaction: async () => "committed",
    submitAsync: async () => "tx9",
    close: () => {},
  } as any;

  const send = async (...messages: object[]) => {
    const ws = new FakeSocket();
    const handler = new JsonRpcHandler(ws as any, {
      createService: async () => service,
    });
    for (const message of messages) {
      await handler.processMessage(JSON.stringify(message));
    }
    return ws.sent;
  };

  const call = (id: string | undefined, method: string) => ({
    jsonrpc: "2.0",
    ...(id === undefined ? {} : { id }),
    method,
    params,
  });

  it("wraps a result in a JSON-RPC envelope carrying the request id", async () => {
    const [reply] = await send(call("7", "fabric_evaluateTransaction"));
    assert.deepEqual(reply, {
      jsonrpc: "2.0",
      result: { balance: 5 },
      id: "7",
    });
  });

  it("wraps a string result", async () => {
    const [reply] = await send(call("8", "fabric_submitTransaction"));
    assert.deepEqual(reply, { jsonrpc: "2.0", result: "committed", id: "8" });
  });

  it("wraps the transaction id of an async submit", async () => {
    const [reply] = await send(call("9", "fabric_submitAsync"));
    assert.deepEqual(reply, {
      jsonrpc: "2.0",
      result: { transactionId: "tx9" },
      id: "9",
    });
  });

  it("answers an unsubscribe with an enveloped true", async () => {
    const ws = new FakeSocket();
    const handler = new JsonRpcHandler(ws as any, {
      createService: async () => service,
    });
    // A connection has made a request, and so created its service, before it
    // can hold a subscription.
    await handler.processMessage(
      JSON.stringify(call("0", "fabric_evaluateTransaction"))
    );
    (handler as any).subscriptions["s1"] = {
      closeListener: () => {},
      service,
    };
    await handler.processMessage(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "10",
        method: "fabric_unsubscribe",
        params: { subscriptionId: "s1" },
      })
    );
    assert.deepEqual(ws.sent[1], { jsonrpc: "2.0", result: true, id: "10" });
  });

  it("keeps an error envelope as it is", async () => {
    const [reply] = await send(call("11", "fabric_nope"));
    assert.equal(reply.error.code, -32601);
    assert.equal(reply.id, "11");
    assert.equal("result" in reply, false);
  });

  it("sends no reply to a request without an id", async () => {
    assert.deepEqual(await send(call(undefined, "fabric_evaluateTransaction")), []);
  });

  it("answers each request of a batch with its own envelope", async () => {
    const [reply] = await send([
      call("a", "fabric_evaluateTransaction"),
      call("b", "fabric_submitTransaction"),
    ]);
    assert.deepEqual(reply, [
      { jsonrpc: "2.0", result: { balance: 5 }, id: "a" },
      { jsonrpc: "2.0", result: "committed", id: "b" },
    ]);
  });
});
