import { connections } from "~background/state"

export const getStoredConnections = async (): Promise<Set<string>> => {
  // Implementation depends on how you store connections
  // This is a placeholder
  return new Set()
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
