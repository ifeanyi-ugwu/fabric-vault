import type {
  FabricProvider,
  FabricProviderInfo,
  FabricSubscription,
  ProviderConnectInfo,
  DisconnectError,
} from "@fabric-vault/types"

export interface Identity {
  label: string
  mspId: string
  certificate: string
}

export interface ChaincodeRef {
  name: string
  contract?: string
}

export interface TransactionParams {
  channel: string
  chaincode: string | ChaincodeRef
  fn: string
  args?: string[]
  identity?: Pick<Identity, "mspId" | "certificate">
}

export interface SubscribeBlockParams {
  channel: string
  startBlock?: number
  identity?: Pick<Identity, "mspId" | "certificate">
}

export interface SubscribeChaincodeParams {
  channel: string
  chaincode: string | ChaincodeRef
  identity?: Pick<Identity, "mspId" | "certificate">
}

export class FabricVaultClient {
  readonly info: FabricProviderInfo

  constructor(
    private readonly provider: FabricProvider,
    info: FabricProviderInfo
  ) {
    this.info = info
  }

  /** Prompt user to authorize identities for this origin. */
  connect(): Promise<Identity[]> {
    return this.provider.request<Identity[]>({
      method: "fabric_requestIdentities",
    })
  }

  /** Returns identities already authorized for this origin. */
  getIdentities(): Promise<Identity[]> {
    return this.provider.request<Identity[]>({ method: "fabric_identities" })
  }

  /** Returns the currently connected peer endpoint. */
  getPeer(): Promise<string> {
    return this.provider.request<string>({ method: "fabric_peer" })
  }

  /** Read-only query — no ledger state change. */
  evaluate(params: TransactionParams): Promise<unknown> {
    return this.provider.request({
      method: "fabric_evaluateTransaction",
      params,
    })
  }

  /** Submit a transaction and wait for ledger commit. */
  submit(params: TransactionParams): Promise<unknown> {
    return this.provider.request({
      method: "fabric_submitTransaction",
      params,
    })
  }

  /** Submit a transaction and return immediately after orderer confirmation. */
  submitAsync(params: TransactionParams): Promise<{ transactionId: string }> {
    return this.provider.request<{ transactionId: string }>({
      method: "fabric_submitAsync",
      params,
    })
  }

  /** Subscribe to block events on a channel. Returns the subscription ID. */
  subscribeBlocks(params: SubscribeBlockParams): Promise<string> {
    return this.provider.request<string>({
      method: "fabric_subscribe",
      params: { eventType: "block", ...params },
    })
  }

  /** Subscribe to chaincode events. Returns the subscription ID. */
  subscribeChaincodeEvents(params: SubscribeChaincodeParams): Promise<string> {
    return this.provider.request<string>({
      method: "fabric_subscribe",
      params: { eventType: "chaincode", ...params },
    })
  }

  /** Cancel an active subscription by ID. */
  unsubscribe(subscriptionId: string): Promise<{ success: boolean }> {
    return this.provider.request<{ success: boolean }>({
      method: "fabric_unsubscribe",
      params: { subscriptionId },
    })
  }

  onConnect(handler: (info: ProviderConnectInfo) => void): this {
    this.provider.on("connect", handler)
    return this
  }

  onDisconnect(handler: (error: DisconnectError) => void): this {
    this.provider.on("disconnect", handler)
    return this
  }

  onIdentitiesChanged(handler: (identities: string[]) => void): this {
    this.provider.on("identitiesChanged", handler)
    return this
  }

  onPeerChanged(handler: (peerEndpoint: string) => void): this {
    this.provider.on("peerChanged", handler)
    return this
  }

  onSubscriptionEvent(handler: (message: FabricSubscription) => void): this {
    this.provider.on("fabric_subscription", handler)
    return this
  }

  /** Escape hatch to the raw FabricProvider for advanced use. */
  get rawProvider(): FabricProvider {
    return this.provider
  }
}
