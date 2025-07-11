import { pendingRequestResolvers } from "~background/state"
import type { SiteIdentityConnection } from "~hooks/use-identity-to-site-connection"
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
  await chrome.storage.local.set({
    fabricVaultConnections: JSON.stringify(connectionsObject)
  })
}

export const handleConnectionMessage = async (
  message: any,
  sender: any,
  sendResponse: any
) => {
  switch (message.type) {
    case "APPROVE_CONNECTION_REQUEST":
      const { id, payload } = message
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
        chrome.storage.local.remove(`pendingRequest_${id}`)

        if (origin && Array.isArray(payload.identities)) {
          await storeConnection(
            origin,
            payload.identities.map((identity) => identity.label)
          )
        }

        const peer = (await chrome.storage.local.get(["selectedPeer"]))
          .selectedPeer
        await emitEventToDapp({
          type: "connect",
          result: {
            peerEndpoint: peer?.endpoint
          }
        })
      }

      sendResponse({ success: true })
      return true

    case "REJECT_CONNECTION_REQUEST":
      const rejectionResolver = pendingRequestResolvers.get(message.id)
      if (rejectionResolver) {
        rejectionResolver.reject(
          new Error("User rejected the connection request")
        )
        pendingRequestResolvers.delete(message.id)
        chrome.storage.local.remove(`pendingRequest_${message.id}`)
      }
      sendResponse({ success: true })
      return true

    case "REJECT_SIGN_REQUEST":
      const signRejectionResolver = pendingRequestResolvers.get(message.id)
      if (signRejectionResolver) {
        signRejectionResolver.reject(new Error("User rejected the request"))
        pendingRequestResolvers.delete(message.id)
        chrome.storage.local.remove(`pendingRequest_${message.id}`)
      }
      sendResponse({ success: true })
      return true

    default:
      return false
  }
}
