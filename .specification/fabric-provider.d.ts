interface FabricProvider {
  /**
   * Sends a JSON-RPC request to the provider.
   */
  request<T = unknown>(args: {
    readonly method: string
    readonly params?: readonly unknown[] | Record<string, unknown>
  }): Promise<T | ProviderRpcError>

  /**
   * Listen for provider events
   */
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

  /**
   * Stop listening for an event.
   */
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

interface ProviderRpcError extends Error {
  code: ProviderRpcErrorCode
  data?: unknown
}

/**
 * userRejectedRequest: The user rejected the request.
 *
 * unauthorized: The requested method and/or identity has not been authorized by the user.
 *
 * unsupportedMethod: The Provider does not support the requested method.
 *
 * disconnected: The Provider is disconnected from all peers.
 *
 * chainDisconnected: The Provider is not connected to the requested peer.
 */
type ProviderRpcErrorCode =
  | 4001 // User Rejected Request
  | 4100 // Unauthorized
  | 4200 // Unsupported Method
  | 4900 // Disconnected
  | 4901 // peer Disconnected
  | number
  | CloseEvent["code"]

interface ProviderMessage {
  readonly type: string
  readonly data: unknown
}

interface ProviderConnectInfo {
  readonly peerEndpoint: string
}

interface DisconnectError extends ProviderRpcError {
  readonly code: CloseEvent["code"]
}

interface FabricSubscription extends ProviderMessage {
  readonly type: "fabric_subscription"
  readonly data: {
    readonly subscription: string
    readonly result: unknown
  }
}

declare global {
  interface Window {
    fabric: FabricProvider
  }
}
