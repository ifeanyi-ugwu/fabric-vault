/**
 * Metadata about the wallet provider.
 */
interface FabricProviderInfo {
  uuid: string // Globally unique ID for this provider instance to differentiate between sessions
  name: string // Human-readable name of the wallet (e.g., "Fabric Vault")
  icon: string // URL to the wallet's icon
  rdns: string // Reverse DNS name (e.g., "com.xxxx.fabricvault")
}

/**
 * The detail object for the 'fabric:announceProvider' event.
 */
interface FabricAnnounceProviderDetail {
  info: FabricProviderInfo
  provider: FabricProvider
}

/**
 * The custom event for announcing a Fabric provider.
 */
interface FabricAnnounceProviderEvent
  extends CustomEvent<FabricAnnounceProviderDetail> {
  type: "fabric:announceProvider"
}

/**
 * The custom event for requesting Fabric provider announcements.
 */
interface FabricRequestProviderEvent extends CustomEvent {
  type: "fabric:requestProvider"
}

declare global {
  interface Window {
    addEventListener(
      type: "fabric:announceProvider",
      listener: (event: FabricAnnounceProviderEvent) => void,
      options?: boolean | AddEventListenerOptions
    ): void
    removeEventListener(
      type: "fabric:announceProvider",
      listener: (event: FabricAnnounceProviderEvent) => void,
      options?: boolean | EventListenerOptions
    ): void
    addEventListener(
      type: "fabric:requestProvider",
      listener: (event: FabricRequestProviderEvent) => void,
      options?: boolean | AddEventListenerOptions
    ): void
    removeEventListener(
      type: "fabric:requestProvider",
      listener: (event: FabricRequestProviderEvent) => void,
      options?: boolean | EventListenerOptions
    ): void
  }
}
