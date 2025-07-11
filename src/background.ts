import {
  connections,
  pendingRequestResolvers,
  subscriptionToPortMap
} from "~background/state"
import { handlePortRequest } from "~handlers/port"
import { handleVaultMessage } from "~handlers/vault"
import { handleWalletMessage } from "~handlers/wallet"
import type { SiteIdentityConnection } from "~hooks/use-identity-to-site-connection"
import { emitEventToDapp, getStoredConnections } from "~services/connection"

/**
 * Vault/Wallet session management using chrome.storage.session
 * This approach keeps the wallet unlocked for the browser session without needing to keep the service worker alive
 * *important: Vault/Wallet must be unlocked to perform any operation involving user identity
 */

const messageRouter = async (request: any, sender: any, sendResponse: any) => {
  // Try vault handlers first
  const vaultHandled = await handleVaultMessage(request, sender, sendResponse)
  if (vaultHandled) return true

  // Then try wallet handlers
  const walletHandled = await handleWalletMessage(request, sender, sendResponse)
  if (walletHandled) return true

  return false
}

chrome.runtime.onMessage.addListener(messageRouter)

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

// --- Listener for DApp connection responses ---
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "APPROVE_CONNECTION_REQUEST") {
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
        storeConnection(
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
  } else if (message.type === "REJECT_CONNECTION_REQUEST") {
    const { id } = message
    const resolver = pendingRequestResolvers.get(id)

    if (resolver) {
      resolver.reject(new Error("User rejected the connection request"))
      pendingRequestResolvers.delete(id)
      chrome.storage.local.remove(`pendingRequest_${id}`)
    }

    sendResponse({ success: true })
    return true
  } else if (message.type === "REJECT_SIGN_REQUEST") {
    const { id } = message
    const resolver = pendingRequestResolvers.get(id)

    if (resolver) {
      resolver.reject(new Error("User rejected the request"))
      pendingRequestResolvers.delete(id)
      chrome.storage.local.remove(`pendingRequest_${id}`)
    }

    sendResponse({ success: true })
    return true
  }
  return false
})

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "fabric") return

  const portRequestIds = new Set<string>()

  // Store the connection with a unique ID
  const tabId = port.sender?.tab?.id
  if (tabId) {
    connections.set(`${tabId}:${port.name}`, port)
  }

  port.onMessage.addListener(async (message) => {
    const { id, method } = message

    if (!id || !method) {
      port.postMessage({
        error: {
          message: "Invalid message format: missing id or method"
        },
        kind: "response",
        from: "background"
      })
      return
    }

    portRequestIds.add(id)

    try {
      const result = await handlePortRequest(message, port)

      port.postMessage({ id, result, kind: "response", from: "background" })
    } catch (err) {
      port.postMessage({
        id,
        error: {
          message: err instanceof Error ? err.message : String(err)
        },
        kind: "response",
        from: "background"
      })
    }
  })

  // Cleanup pending requests associated with this port if disconnected
  port.onDisconnect.addListener(() => {
    //this check for name is because of plasmo's port that's almost frequently connecting and disconnecting
    if (port.name !== "fabric") return

    portRequestIds.forEach((requestId) => {
      if (pendingRequestResolvers.has(requestId)) {
        // the port is disconnected anyway, it wont be receiving the rejection and there would be no pending promises since the listener goes with the port
        //const { reject } = pendingRequestResolvers.get(requestId)!
        //reject(new Error("Request cancelled: DApp port disconnected."))
        pendingRequestResolvers.delete(requestId)
        chrome.storage.local.remove(`pendingRequest_${requestId}`)
      }
    })
    portRequestIds.clear()

    // --- NEW: Clean up subscriptions for this disconnected port ---
    const disconnectedOrigin = port.sender?.origin
    if (chrome.runtime.lastError) {
      console.error(
        `Port disconnected for origin: ${disconnectedOrigin}. Port name: ${port.name}. Error:`,
        chrome.runtime.lastError.message
      )
    } else {
      console.log(
        `Port disconnected for origin: ${disconnectedOrigin}. Port name: ${port.name}. No specific error reported.`
      )
    }
    if (disconnectedOrigin) {
      subscriptionToPortMap.forEach((value, subId) => {
        if (value.origin === disconnectedOrigin) {
          // If your backend supports it, you might want to send an
          // explicit unsubscribe message to the server for these.
          // For now, just remove from our local map.
          console.log(
            `Cleaning up subscription ${subId} for disconnected origin ${disconnectedOrigin}`
          )
          subscriptionToPortMap.delete(subId)
        }
      })
    }
    // You might also want to close the WebSocket if no more subscriptions are active on it.
    // This can be complex if multiple dApps share one WebSocket.
    // A simple approach is to have a counter for active subscriptions per WS,
    // and close when count hits zero.

    if (tabId) {
      connections.delete(`${tabId}:${port.name}`)
      console.log(`❌ Port disconnected: ${port.name} from tab ${tabId}`)
    }
  })
})
