export interface FabricProvider {
  request<T = unknown>(args: {
    readonly method: string
    readonly params?: readonly unknown[] | Record<string, unknown>
  }): Promise<T | ProviderRpcError>

  on(event: "message", handler: (message: ProviderMessage) => void): this
  on(
    event: "fabric_subscription",
    handler: (message: FabricSubscription) => void
  ): this
  on(
    event: "connect",
    handler: (connectInfo: ProviderConnectInfo) => void
  ): this
  on(event: "disconnect", handler: (error: DisconnectError) => void): this
  on(event: "peerChanged", handler: (peerEndpoint: string) => void): this
  on(event: "identitiesChanged", handler: (identities: string[]) => void): this

  removeListener(
    event: "message",
    handler: (message: ProviderMessage) => void
  ): this
  removeListener(
    event: "fabric_subscription",
    handler: (message: FabricSubscription) => void
  ): this
  removeListener(
    event: "connect",
    handler: (connectInfo: ProviderConnectInfo) => void
  ): this
  removeListener(
    event: "disconnect",
    handler: (error: DisconnectError) => void
  ): this
  removeListener(
    event: "peerChanged",
    handler: (peerEndpoint: string) => void
  ): this
  removeListener(
    event: "identitiesChanged",
    handler: (identities: string[]) => void
  ): this
}

export interface ProviderRpcError extends Error {
  code: ProviderRpcErrorCode
  data?: unknown
}

/**
 * 4001: User rejected the request.
 * 4100: Method/identity not authorized by the user.
 * 4200: Provider does not support the requested method.
 * 4900: Provider is disconnected from all peers.
 * 4901: Provider is not connected to the requested peer.
 */
export type ProviderRpcErrorCode =
  | 4001
  | 4100
  | 4200
  | 4900
  | 4901
  | number
  | CloseEvent["code"]

export interface ProviderMessage {
  readonly type: string
  readonly data: unknown
}

export interface ProviderConnectInfo {
  readonly peerEndpoint: string
}

export interface DisconnectError extends ProviderRpcError {
  readonly code: CloseEvent["code"]
}

export interface FabricSubscription extends ProviderMessage {
  readonly type: "fabric_subscription"
  readonly data: {
    readonly subscription: string
    readonly result: unknown
  }
}
