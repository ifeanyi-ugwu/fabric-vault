import {
  CommitError,
  Identity,
  Signer,
  Gateway,
  Network,
} from "@hyperledger/fabric-gateway";
import { initGateway } from "./lib/gateway";
import { getOrCreateGrpcClient } from "./lib/grpc";

export type SignKind =
  | "proposal"
  | "transaction"
  | "commit"
  | "chaincodeEvents"
  | "blockEvents";

/** Signs the serialized request of the given kind and returns the signature. */
export type RequestSigner = (
  kind: SignKind,
  bytes: Uint8Array
) => Promise<Uint8Array>;

/**
 * How requests are signed. `digest` hands the client library a callback that
 * sees only a hash. `request` signs each serialized request, so the signer can
 * inspect what it signs.
 */
export type Signing = { digest: Signer } | { request: RequestSigner };

export class FabricService {
  static async createForUser(
    identity: Identity,
    signing: Signing,
    peer: {
      name: string;
      endpoint: string;
      tlsRootCert?: string;
    }
  ) {
    const { name, endpoint, tlsRootCert } = peer;

    const client = await getOrCreateGrpcClient({
      peerEndpoint: endpoint,
      peerName: name,
      tlsRootCert,
    });
    const gateway = await initGateway(
      client,
      identity,
      "digest" in signing ? signing.digest : undefined
    );

    return new FabricService(
      gateway,
      client,
      "request" in signing ? signing.request : undefined
    );
  }

  private constructor(
    private gateway: Gateway,
    private client: any,
    private signRequest?: RequestSigner
  ) {}

  close(): void {
    this.gateway.close();
    //this.client.close(); //client is cached and auto cleaned up in the cache
  }

  getNetwork(channelName: string): Network {
    return this.gateway.getNetwork(channelName);
  }

  async evaluateTransaction({
    channelName,
    chaincodeName,
    contractName,
    fn,
    args = [],
  }: {
    channelName: string;
    chaincodeName: string;
    contractName?: string;
    fn: string;
    args: string[];
  }) {
    if (this.signRequest) {
      const proposal = this.newProposal(
        { channelName, chaincodeName, contractName },
        fn,
        args
      );
      const result = await (await this.signedProposal(proposal)).evaluate();
      return decodeResult(result);
    }

    const result = await this.gateway
      .getNetwork(channelName)
      .getContract(chaincodeName, contractName)
      .evaluateTransaction(fn, ...args);

    return decodeResult(result);
  }

  async submitTransaction({
    channelName,
    chaincodeName,
    contractName,
    fn,
    args = [],
  }: {
    channelName: string;
    chaincodeName: string;
    contractName?: string;
    fn: string;
    args: string[];
  }) {
    if (this.signRequest) {
      const { transaction, commit } = await this.submitSigned(
        { channelName, chaincodeName, contractName },
        fn,
        args
      );
      const signedCommit = this.gateway.newSignedCommit(
        commit.getBytes(),
        await this.signRequest("commit", commit.getBytes())
      );
      const status = await signedCommit.getStatus();
      if (!status.successful) {
        throw new CommitError({
          code: status.code,
          transactionId: status.transactionId,
          message: `Transaction ${status.transactionId} failed to commit with status code ${status.code}`,
        });
      }
      return decodeResult(transaction.getResult());
    }

    const result = await this.gateway
      .getNetwork(channelName)
      .getContract(chaincodeName, contractName)
      .submitTransaction(fn, ...args);

    return decodeResult(result);
  }

  async submitAsync({
    channelName,
    chaincodeName,
    contractName,
    fn,
    args = [],
  }: {
    channelName: string;
    chaincodeName: string;
    contractName?: string;
    fn: string;
    args: string[];
  }) {
    if (this.signRequest) {
      const { commit } = await this.submitSigned(
        { channelName, chaincodeName, contractName },
        fn,
        args
      );
      return commit.getTransactionId();
    }

    const submittedTransaction = await this.gateway
      .getNetwork(channelName)
      .getContract(chaincodeName, contractName)
      .submitAsync(fn, { arguments: args });

    return submittedTransaction.getTransactionId();
  }

  async subscribeToChaincodeEvents(
    channelName: string,
    chaincodeName: string,
    options: {
      eventNames?: string[];
      startBlock?: bigint;
      endBlock?: bigint;
      maxEvents?: number;
    } = {}
  ) {
    const network = this.gateway.getNetwork(channelName);
    const eventsOptions: any = {};

    if (options.startBlock !== undefined) {
      eventsOptions.startBlock = options.startBlock;
    }

    if (this.signRequest) {
      const bytes = network
        .newChaincodeEventsRequest(chaincodeName, eventsOptions)
        .getBytes();
      const signature = await this.signRequest("chaincodeEvents", bytes);
      return this.gateway
        .newSignedChaincodeEventsRequest(bytes, signature)
        .getEvents();
    }

    return network.getChaincodeEvents(chaincodeName, eventsOptions);
  }

  async subscribeToBlockEvents(
    channelName: string,
    options: { startBlock?: bigint } = {}
  ): Promise<Awaited<ReturnType<Network["getBlockEvents"]>>> {
    const network = this.gateway.getNetwork(channelName);
    if (this.signRequest) {
      const bytes = network.newBlockEventsRequest(options).getBytes();
      const signature = await this.signRequest("blockEvents", bytes);
      return this.gateway
        .newSignedBlockEventsRequest(bytes, signature)
        .getEvents();
    }

    return network.getBlockEvents(options);
  }

  private newProposal(
    {
      channelName,
      chaincodeName,
      contractName,
    }: { channelName: string; chaincodeName: string; contractName?: string },
    fn: string,
    args: string[]
  ) {
    return this.gateway
      .getNetwork(channelName)
      .getContract(chaincodeName, contractName)
      .newProposal(fn, { arguments: args });
  }

  private async signedProposal(
    proposal: ReturnType<FabricService["newProposal"]>
  ) {
    const bytes = proposal.getBytes();
    return this.gateway.newSignedProposal(
      bytes,
      await this.signRequest!("proposal", bytes)
    );
  }

  /** Signs and endorses a proposal, then signs and submits the transaction. */
  private async submitSigned(
    target: { channelName: string; chaincodeName: string; contractName?: string },
    fn: string,
    args: string[]
  ) {
    const signedProposal = await this.signedProposal(
      this.newProposal(target, fn, args)
    );
    const transaction = await signedProposal.endorse();
    const signedTransaction = this.gateway.newSignedTransaction(
      transaction.getBytes(),
      await this.signRequest!("transaction", transaction.getBytes())
    );
    const commit = await signedTransaction.submit();
    return { transaction, commit };
  }
}


function decodeResult(resultBytes: Uint8Array): object | string {
  const utf8Decoder = new TextDecoder();
  const resultJson = utf8Decoder.decode(resultBytes);
  try {
    return JSON.parse(resultJson);
  } catch {
    return resultJson;
  }
}
