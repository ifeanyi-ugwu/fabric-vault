import { isSecureGatewayUrl } from "./gateway-url"

/** A peer a dApp asks the extension to use. */
export interface PeerRequest {
  name: string
  endpoint: string
  rpcUrl: string
  tlsRootCert: string | null
}

/** The fields of a stored peer this module reads and writes. */
export interface StoredPeer extends PeerRequest {
  id: string
  legacySigning?: boolean
}

const MAX_NAME_LENGTH = 100
const MAX_CERT_LENGTH = 20_000
const HOSTNAME_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/i
const PEM_CERTIFICATE =
  /^-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\s]+-----END CERTIFICATE-----\s*$/

export class PeerRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PeerRequestError"
  }
}

function isEndpoint(value: string): boolean {
  const match = /^(?:\[([0-9a-f:.]+)\]|([^:\s/]+)):(\d{1,5})$/i.exec(value)
  if (!match) return false
  const port = Number(match[3])
  if (port < 1 || port > 65535) return false
  if (match[1] !== undefined) return true
  const host = match[2]
  return (
    host.length <= 253 && host.split(".").every((l) => HOSTNAME_LABEL.test(l))
  )
}

/**
 * Validates the params of a `fabric_requestPeer` call. Only these four fields
 * are read: anything else a dApp sends, including `legacySigning` and `id`, is
 * dropped, so a page cannot loosen what the extension accepts from a gateway.
 */
export function parsePeerRequest(params: unknown): PeerRequest {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    throw new PeerRequestError("The request has no peer.")
  }
  const { name, endpoint, rpcUrl, tlsRootCert } = params as Record<
    string,
    unknown
  >

  if (typeof name !== "string" || name.trim() === "") {
    throw new PeerRequestError("The peer has no name.")
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new PeerRequestError("The peer name is too long.")
  }
  if (typeof endpoint !== "string" || !isEndpoint(endpoint.trim())) {
    throw new PeerRequestError("The peer endpoint must be host:port.")
  }
  if (typeof rpcUrl !== "string" || !isSecureGatewayUrl(rpcUrl.trim())) {
    throw new PeerRequestError(
      "The gateway URL must use wss://. ws:// is accepted only for localhost."
    )
  }
  let cert: string | null = null
  if (tlsRootCert !== undefined && tlsRootCert !== null) {
    if (
      typeof tlsRootCert !== "string" ||
      tlsRootCert.length > MAX_CERT_LENGTH ||
      !PEM_CERTIFICATE.test(tlsRootCert)
    ) {
      throw new PeerRequestError(
        "The TLS root certificate is not a PEM certificate."
      )
    }
    cert = tlsRootCert
  }
  return {
    name: name.trim(),
    endpoint: endpoint.trim(),
    rpcUrl: rpcUrl.trim(),
    tlsRootCert: cert
  }
}

/** A PEM certificate as the same text whatever its line endings or trailing newline. */
const certificateText = (cert: string | null | undefined) =>
  (cert ?? "").replace(/\s+/g, "")

/** Two peers are the same when they reach the same node through the same gateway. */
export function samePeer(a: PeerRequest, b: PeerRequest): boolean {
  return (
    a.endpoint === b.endpoint &&
    a.rpcUrl === b.rpcUrl &&
    certificateText(a.tlsRootCert) === certificateText(b.tlsRootCert)
  )
}

/**
 * The peer list and selection after the user approves a peer request. A peer
 * that is already stored keeps everything the user set on it, `legacySigning`
 * included. A new one starts with legacy signing off.
 */
export function applyPeerRequest(
  peers: StoredPeer[],
  request: PeerRequest,
  newId: string
): { peers: StoredPeer[]; selected: StoredPeer; added: boolean } {
  const existing = peers.find((peer) => samePeer(peer, request))
  if (existing) return { peers, selected: existing, added: false }
  const added: StoredPeer = { id: newId, ...request, legacySigning: false }
  return { peers: [...peers, added], selected: added, added: true }
}
