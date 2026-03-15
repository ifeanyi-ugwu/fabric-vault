import browser from "webextension-polyfill"

import { pendingRequestResolvers } from "~background/state"
import type { SiteIdentityConnection } from "~hooks/use-identity-to-site-connection"
import type { Peer } from "~contexts/peer"
import { emitEventToDapp, getStoredConnections } from "~services/connection"

async function storeConnection(origin: string, labels: string[]) {
  const storedConnections = await getStoredConnections()
  const existingConnectionsForSite = storedConnections.get(origin) || []
  const newConnections: SiteIdentityConnection[] = labels
    .map((label) => ({ identityLabel: label, timestamp: Date.now() }))
    .filter(
      (newConnection) =>
        !existingConnectionsForSite.some(
          (existing) => existing.identityLabel === newConnection.identityLabel
        )
    )

  storedConnections.set(origin, [
    ...existingConnectionsForSite,
    ...newConnections
  ])

  const connectionsObject = Object.fromEntries(storedConnections)
  await browser.storage.local.set({ fabricVaultConnections: JSON.stringify(connectionsObject) })
}

export const handleConnectionMessage = async (request: any, _sender: any) => {
  switch (request.type) {
    case "APPROVE_CONNECTION_REQUEST": {
      const { id, payload } = request
      const { origin } = payload
      const resolver = pendingRequestResolvers.get(id)
      const identities = payload.identities.map((id) => ({
        label: id.label,
        mspId: id.mspId,
        certificate: id.certificate
      }))

      if (resolver) {
        resolver.resolve(identities)
        pendingRequestResolvers.delete(id)
        browser.storage.local.remove(`pendingRequest_${id}`)

        if (origin && Array.isArray(payload.identities)) {
          await storeConnection(
            origin,
            payload.identities.map((identity) => identity.label)
          )
        }

        const peer = (await browser.storage.local.get("selectedPeer"))["selectedPeer"] as Peer | undefined
        await emitEventToDapp({
          type: "connect",
          result: {
            peerEndpoint: peer?.endpoint
          }
        })
      }

      return { success: true }
    }

    case "REJECT_CONNECTION_REQUEST": {
      const resolver = pendingRequestResolvers.get(request.id)
      if (resolver) {
        resolver.reject(new Error("User rejected the connection request"))
        pendingRequestResolvers.delete(request.id)
        browser.storage.local.remove(`pendingRequest_${request.id}`)
      }
      return { success: true }
    }

    case "REJECT_SIGN_REQUEST": {
      const resolver = pendingRequestResolvers.get(request.id)
      if (resolver) {
        resolver.reject(new Error("User rejected the request"))
        pendingRequestResolvers.delete(request.id)
        browser.storage.local.remove(`pendingRequest_${request.id}`)
      }
      return { success: true }
    }

    default:
      return undefined
  }
}
