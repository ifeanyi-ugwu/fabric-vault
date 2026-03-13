import type { FabricProvider } from "./provider"

export interface FabricProviderInfo {
  uuid: string
  name: string
  icon: string
  rdns: string
}

export interface FabricAnnounceProviderDetail {
  info: FabricProviderInfo
  provider: FabricProvider
}

export interface FabricAnnounceProviderEvent
  extends CustomEvent<FabricAnnounceProviderDetail> {
  type: "fabric:announceProvider"
}

export interface FabricRequestProviderEvent extends CustomEvent {
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
