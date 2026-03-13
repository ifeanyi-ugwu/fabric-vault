import type {
  FabricAnnounceProviderEvent,
  FabricProviderInfo,
  FabricProvider,
} from "@fabric-vault/types"

export interface DiscoveredProvider {
  info: FabricProviderInfo
  provider: FabricProvider
}

/**
 * Fires `fabric:requestProvider` to prompt already-loaded extensions to
 * announce themselves, then listens for `fabric:announceProvider` events
 * and calls `onDiscovered` for each one.
 *
 * Returns a cleanup function that removes the listener.
 */
export function requestProviders(
  onDiscovered: (provider: DiscoveredProvider) => void
): () => void {
  const handler = (event: FabricAnnounceProviderEvent) => {
    onDiscovered({ info: event.detail.info, provider: event.detail.provider })
  }

  window.addEventListener("fabric:announceProvider", handler as EventListener)
  window.dispatchEvent(new CustomEvent("fabric:requestProvider"))

  return () => {
    window.removeEventListener(
      "fabric:announceProvider",
      handler as EventListener
    )
  }
}

/**
 * Convenience wrapper that resolves with the first discovered provider or
 * rejects after `timeoutMs` if none announces itself.
 */
export function waitForProvider(timeoutMs = 3000): Promise<DiscoveredProvider> {
  return new Promise((resolve, reject) => {
    const cleanup = requestProviders((discovered) => {
      cleanup()
      clearTimeout(timer)
      resolve(discovered)
    })

    const timer = setTimeout(() => {
      cleanup()
      reject(
        new Error(
          `No Fabric Vault provider found within ${timeoutMs}ms. Is the extension installed?`
        )
      )
    }, timeoutMs)
  })
}
