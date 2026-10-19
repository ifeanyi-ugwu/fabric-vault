export interface GatewayIdentity {
  mspId: string
  certificate: string
}

export interface GatewayPeer {
  name: string
  endpoint: string
  tlsRootCert?: string | null
}

/**
 * The params sent to the gateway for a dApp request. The dApp supplies the
 * chaincode call; the identity and the peer come from the extension. They are
 * written after the dApp's params so a dApp-supplied `identity` or `peer`
 * cannot replace the ones the user approved.
 */
export function buildGatewayParams(
  dappParams: Record<string, unknown> | undefined,
  identity: GatewayIdentity,
  peer: GatewayPeer
): Record<string, unknown> {
  return {
    ...(dappParams ?? {}),
    identity: { mspId: identity.mspId, certificate: identity.certificate },
    peer: {
      name: peer.name,
      endpoint: peer.endpoint,
      tlsRootCert: peer.tlsRootCert
    }
  }
}
