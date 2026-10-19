import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Client, credentials } from "@grpc/grpc-js";
import { connect, hash } from "@hyperledger/fabric-gateway";
import { FabricService } from "./fabric.service";

function serviceOver(gateway: unknown) {
  return new (FabricService as any)(gateway, {}) as FabricService;
}

const call = {
  channelName: "mychannel",
  chaincodeName: "basic",
  fn: "TransferAsset",
  args: ["asset1", "Tom"],
};

describe("submitAsync", () => {
  it("hands the library the arguments as an array", async () => {
    let received: unknown;
    const service = serviceOver({
      getNetwork: () => ({
        getContract: () => ({
          submitAsync: async (_fn: string, options: { arguments: unknown }) => {
            received = options.arguments;
            return { getTransactionId: () => "tx1" };
          },
        }),
      }),
    });
    await service.submitAsync(call);
    assert.deepEqual(received, ["asset1", "Tom"]);
  });

  for (const args of [[], ["asset1", "Tom"]]) {
    it(`builds a proposal with ${args.length} arguments in the real client library`, async () => {
      // The peer is unreachable, so the call must get past building and
      // signing the proposal and fail at the network.
      let signed = 0;
      const gateway = connect({
        client: new Client("127.0.0.1:1", credentials.createInsecure()),
        identity: { mspId: "Org1MSP", credentials: new Uint8Array([1]) },
        signer: async () => {
          signed += 1;
          return new Uint8Array([2]);
        },
        hash: hash.sha256,
      });
      try {
        await assert.rejects(
          serviceOver(gateway).submitAsync({ ...call, args }),
          (err: Error) => !(err instanceof TypeError)
        );
        assert.equal(signed, 1, "the proposal was signed");
      } finally {
        gateway.close();
      }
    });
  }
});

describe("signed requests", () => {
  const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  const bytes = (value: string) => new TextEncoder().encode(value);

  function stubbed(options: { commitSuccessful?: boolean } = {}) {
    const log: string[] = [];
    const proposal = {
      getBytes: () => bytes("proposal-bytes"),
      getTransactionId: () => "tx1",
    };
    const transaction = {
      getBytes: () => bytes("transaction-bytes"),
      getResult: () => bytes('{"balance":5}'),
    };
    const commit = {
      getBytes: () => bytes("commit-bytes"),
      getTransactionId: () => "tx1",
    };
    const gateway = {
      getNetwork: () => ({
        getContract: () => ({
          newProposal: (fn: string, opts: { arguments: string[] }) => {
            log.push(`newProposal ${fn} ${opts.arguments.join(",")}`);
            return proposal;
          },
        }),
        newChaincodeEventsRequest: () => ({ getBytes: () => bytes("cc-events") }),
        newBlockEventsRequest: () => ({ getBytes: () => bytes("block-events") }),
      }),
      newSignedProposal: (b: Uint8Array, signature: Uint8Array) => {
        log.push(`newSignedProposal ${text(b)} ${text(signature)}`);
        return {
          evaluate: async () => {
            log.push("evaluate");
            return bytes('"read"');
          },
          endorse: async () => {
            log.push("endorse");
            return transaction;
          },
        };
      },
      newSignedTransaction: (b: Uint8Array, signature: Uint8Array) => {
        log.push(`newSignedTransaction ${text(b)} ${text(signature)}`);
        return {
          submit: async () => {
            log.push("submit");
            return commit;
          },
        };
      },
      newSignedCommit: (b: Uint8Array, signature: Uint8Array) => {
        log.push(`newSignedCommit ${text(b)} ${text(signature)}`);
        return {
          getStatus: async () => {
            log.push("getStatus");
            return {
              successful: options.commitSuccessful ?? true,
              code: options.commitSuccessful === false ? 11 : 0,
              transactionId: "tx1",
            };
          },
        };
      },
      newSignedChaincodeEventsRequest: (b: Uint8Array, signature: Uint8Array) => ({
        getEvents: async () => {
          log.push(`chaincodeEvents ${text(b)} ${text(signature)}`);
          return "events";
        },
      }),
      newSignedBlockEventsRequest: (b: Uint8Array, signature: Uint8Array) => ({
        getEvents: async () => {
          log.push(`blockEvents ${text(b)} ${text(signature)}`);
          return "blocks";
        },
      }),
    };
    const signRequest = async (kind: string, b: Uint8Array) => {
      log.push(`sign ${kind} ${text(b)}`);
      return bytes(`sig-${kind}`);
    };
    const service = new (FabricService as any)(
      gateway,
      {},
      signRequest
    ) as FabricService;
    return { service, log };
  }

  it("signs the proposal, then evaluates it, for an evaluate", async () => {
    const { service, log } = stubbed();
    const result = await service.evaluateTransaction(call);
    assert.equal(result, "read");
    assert.deepEqual(log, [
      "newProposal TransferAsset asset1,Tom",
      "sign proposal proposal-bytes",
      "newSignedProposal proposal-bytes sig-proposal",
      "evaluate",
    ]);
  });

  it("signs the proposal, the transaction and the commit request, in order, for a submit", async () => {
    const { service, log } = stubbed();
    const result = await service.submitTransaction(call);
    assert.deepEqual(result, { balance: 5 });
    assert.deepEqual(log, [
      "newProposal TransferAsset asset1,Tom",
      "sign proposal proposal-bytes",
      "newSignedProposal proposal-bytes sig-proposal",
      "endorse",
      "sign transaction transaction-bytes",
      "newSignedTransaction transaction-bytes sig-transaction",
      "submit",
      "sign commit commit-bytes",
      "newSignedCommit commit-bytes sig-commit",
      "getStatus",
    ]);
  });

  it("signs a proposal and a transaction, and no commit request, for an async submit", async () => {
    const { service, log } = stubbed();
    assert.equal(await service.submitAsync(call), "tx1");
    assert.deepEqual(
      log.filter((entry) => entry.startsWith("sign ")),
      ["sign proposal proposal-bytes", "sign transaction transaction-bytes"]
    );
    assert.equal(log.includes("getStatus"), false);
  });

  it("fails a submit whose commit status is not successful", async () => {
    const { service } = stubbed({ commitSuccessful: false });
    await assert.rejects(
      service.submitTransaction(call),
      /Transaction tx1 failed to commit with status code 11/
    );
  });

  it("stops before endorsing when the client refuses to sign the proposal", async () => {
    const { service, log } = stubbed();
    (service as any).signRequest = async () => {
      throw new Error("The call is not the approved call.");
    };
    await assert.rejects(
      service.submitTransaction(call),
      /not the approved call/
    );
    assert.equal(log.includes("endorse"), false);
  });

  it("stops before submitting when the client refuses to sign the transaction", async () => {
    const { service, log } = stubbed();
    (service as any).signRequest = async (kind: string) => {
      if (kind === "transaction") throw new Error("refused");
      return bytes(`sig-${kind}`);
    };
    await assert.rejects(service.submitTransaction(call), /refused/);
    assert.equal(log.includes("endorse"), true);
    assert.equal(log.includes("submit"), false);
  });

  it("signs the serialized events request before opening the stream", async () => {
    const { service, log } = stubbed();
    assert.equal(
      await service.subscribeToChaincodeEvents("mychannel", "basic"),
      "events"
    );
    assert.equal(await service.subscribeToBlockEvents("mychannel"), "blocks");
    assert.deepEqual(log, [
      "sign chaincodeEvents cc-events",
      "chaincodeEvents cc-events sig-chaincodeEvents",
      "sign blockEvents block-events",
      "blockEvents block-events sig-blockEvents",
    ]);
  });

  describe("with the real client library and no signer", () => {
    const withLibrary = async (
      use: (service: FabricService, kinds: string[]) => Promise<void>
    ) => {
      const kinds: string[] = [];
      const client = new Client("127.0.0.1:1", credentials.createInsecure());
      const gateway = connect({
        client,
        identity: { mspId: "Org1MSP", credentials: new Uint8Array([1]) },
        hash: hash.sha256,
      });
      const service = new (FabricService as any)(gateway, client, async (kind: string) => {
        kinds.push(kind);
        return new Uint8Array([2]);
      }) as FabricService;
      try {
        await use(service, kinds);
      } finally {
        gateway.close();
        client.close();
      }
    };

    it("accepts the signature for an evaluate and reaches the network", async () => {
      await withLibrary(async (service, kinds) => {
        await assert.rejects(
          service.evaluateTransaction(call),
          (err: Error) => !(err instanceof TypeError)
        );
        assert.deepEqual(kinds, ["proposal"]);
      });
    });

    it("accepts the signature for a submit and reaches the network", async () => {
      await withLibrary(async (service, kinds) => {
        await assert.rejects(
          service.submitTransaction(call),
          (err: Error) => !(err instanceof TypeError)
        );
        assert.deepEqual(kinds, ["proposal"]);
      });
    });

    it("signs a chaincode events request", async () => {
      await withLibrary(async (service, kinds) => {
        const events = await service.subscribeToChaincodeEvents("mychannel", "basic");
        // Closing cancels the stream, which reports an error to the reader.
        const reading = events[Symbol.asyncIterator]().next().catch(() => {});
        events.close();
        await reading;
        assert.deepEqual(kinds, ["chaincodeEvents"]);
      });
    });

    it("signs a block events request", async () => {
      await withLibrary(async (service, kinds) => {
        const events = await service.subscribeToBlockEvents("mychannel");
        // Closing cancels the stream, which reports an error to the reader.
        const reading = events[Symbol.asyncIterator]().next().catch(() => {});
        events.close();
        await reading;
        assert.deepEqual(kinds, ["blockEvents"]);
      });
    });
  });
});
