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
