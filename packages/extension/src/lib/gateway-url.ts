const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

/**
 * A gateway reached over plain ws:// exposes every signature request and
 * response to the network path. Only wss:// and loopback are accepted.
 */
export function isSecureGatewayUrl(rpcUrl: string): boolean {
  let url: URL
  try {
    url = new URL(rpcUrl)
  } catch {
    return false
  }
  if (url.protocol === "wss:") return true
  return url.protocol === "ws:" && LOOPBACK_HOSTS.has(url.hostname)
}

export function assertSecureGatewayUrl(rpcUrl: string): void {
  if (!isSecureGatewayUrl(rpcUrl)) {
    throw new Error(
      `Gateway ${rpcUrl} must use wss://. Plain ws:// is accepted only for localhost.`
    )
  }
}
