import { connections } from "~background/state"
import type { SiteIdentityConnection } from "~hooks/use-identity-to-site-connection"

export async function getStoredConnections(): Promise<
  Map<string, SiteIdentityConnection[]>
> {
  try {
    const result = await chrome.storage.local.get("fabricVaultConnections")
    const storedConnections = result.fabricVaultConnections
    if (storedConnections) {
      return new Map(Object.entries(JSON.parse(storedConnections)))
    }
    return new Map()
  } catch (error) {
    //console.error("Error getting stored connections:", error)
    return new Map()
  }
}

export const isConnected = async (
  origin: string | undefined
): Promise<boolean> => {
  if (!origin) return false
  const storedConnections = await getStoredConnections()
  return storedConnections.has(origin)
}

export const emitEventToDapp = async ({
  type,
  result
}: {
  type: string
  result: any
}) => {
  // Notify content scripts (and thus injected scripts) about the event
  for (const port of connections.values()) {
    port.postMessage({
      type,
      result,
      kind: "event",
      from: "background"
    })
  }
}
