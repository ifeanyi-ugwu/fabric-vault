import {
  activeSubscriptionWebSockets,
  connections,
  pendingRequestResolvers,
  subscriptionToPortMap,
  wallet
} from "~background/state"
import type { Identity } from "~contexts/identity"
import { handleVaultMessage } from "~handlers/vault"
import { handleWalletMessage } from "~handlers/wallet"
import type { SiteIdentityConnection } from "~hooks/use-identity-to-site-connection"
import { emitEventToDapp } from "~services/connection"
import { handleSignRequest } from "~services/wallet"

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
      const result = await handleRequest(message, port)

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

async function isConnectedToIdentity(
  origin: string | undefined,
  identityLabel: string | undefined
): Promise<boolean> {
  if (!origin) return false
  const storedConnections = await getStoredConnections()
  const connectionsForOrigin = storedConnections.get(origin)
  return !!connectionsForOrigin?.some(
    (connection) => connection.identityLabel === identityLabel
  )
}

async function getActiveIdentityLabel(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["selectedIdentity"], (result) => {
      resolve(result.selectedIdentity?.label || null)
    })
  })
}

async function determineAndValidateIdentity({
  identity,
  origin
}: {
  identity?: any
  origin?: string
}): Promise<{ label?: string; mspId?: string; certificate?: string }> {
  let identityToUseForConnection: {
    label?: string
    mspId?: string
    certificate?: string
  } = {}

  // --- 1. Determine the *intended* identity for the transaction/action. i.e identifying *which* identity the dApp wants to use.
  if (identity) {
    // If dApp provided an identity (e.g., via `params.identity.certificate`),
    identityToUseForConnection.mspId = identity.mspId
    identityToUseForConnection.certificate = identity.certificate

    if (identity.certificate) {
      identityToUseForConnection.label = await wallet.getLabelByCertificate(
        identity.certificate
      )
      console.log(
        "Derived label from certificate:",
        identityToUseForConnection.label
      )
    } else if (identity.label) {
      // Fallback if certificate not provided but label is (less reliable as label isn't unique enough for security usually) originally meant for display
      identityToUseForConnection.mspId = identity.mspId.label = identity.label
      console.log(
        "Using label from message:",
        (identityToUseForConnection.mspId = identity.mspId.label)
      )
    }
  } else {
    // If no identity explicitly provided by dApp, use the currently active one.
    const activeIdentityPublicInfo = (
      await chrome.storage.local.get("selectedIdentity")
    ).selectedIdentity
    if (activeIdentityPublicInfo) {
      identityToUseForConnection.label = activeIdentityPublicInfo.label
      identityToUseForConnection.mspId = activeIdentityPublicInfo.mspId
      identityToUseForConnection.certificate =
        activeIdentityPublicInfo.certificate
    }
  }

  // --- 2. CRITICAL: Check if there's *any* identity identified to use.
  if (
    !identityToUseForConnection.label &&
    !identityToUseForConnection.certificate
  ) {
    throw new Error(
      "No identity specified by DApp and no active identity set. Please select or provide an identity."
    )
  }

  // --- 3. CRITICAL: Validate if the site is *connected* to this intended identity.
  if (
    !(await isConnectedToIdentity(origin, identityToUseForConnection.label))
  ) {
    console.log(
      "Site is not connected to the requested identity:",
      identityToUseForConnection.label || identityToUseForConnection.certificate
    )
    throw new Error(
      `Site is not connected to the identity: ${
        identityToUseForConnection.label ||
        identityToUseForConnection.certificate
      }. Please connect your wallet to this identity.`
    )
  }

  return identityToUseForConnection
}

// ===============================
// Request Handlers
// ===============================
async function handleRequest(message: any, port: chrome.runtime.Port) {
  const { method } = message
  const origin = port.sender?.origin

  switch (method) {
    case "fabric_requestIdentities":
      return await openAuthorizationPopup(port, message, "connect")
    case "fabric_identities":
      return await handleIdentitiesRequest(port)
    case "fabric_evaluateTransaction":
    case "fabric_submitTransaction":
    case "fabric_submitAsync":
      const identityForSubmission = await determineAndValidateIdentity({
        identity: message.params.identity,
        origin
      })

      return await openAuthorizationPopup(
        port,
        {
          method: message.method,
          params: {
            ...message.params,
            identity: identityForSubmission
          }
        },
        "sign"
      )
    case "fabric_subscribe":
    case "fabric_unsubscribe":
      const identityForSubscription = await determineAndValidateIdentity({
        identity: message.params.identity,
        origin
      })

      const selectedPeer = (await chrome.storage.local.get("selectedPeer"))
        .selectedPeer

      if (!selectedPeer || !selectedPeer.rpcUrl) {
        throw new Error(
          "No peer selected or peer RPC URL missing for subscription."
        )
      }

      // Get or create WebSocket connection for this peer
      let ws = activeSubscriptionWebSockets.get(selectedPeer.rpcUrl)
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        ws = new WebSocket(selectedPeer.rpcUrl)
        activeSubscriptionWebSockets.set(selectedPeer.rpcUrl, ws)

        // Handle WebSocket events for this new connection
        ws.onopen = () => {
          console.log(
            `WebSocket for subscriptions connected to ${selectedPeer.rpcUrl}`
          )
          // If there are pending subscriptions that were waiting, send them now.
          // (This is a more advanced topic for later, but keep in mind)
        }
        ws.onerror = (event) => {
          console.error(
            `WebSocket for subscriptions error on ${selectedPeer.rpcUrl}:`,
            event
          )
          activeSubscriptionWebSockets.delete(selectedPeer.rpcUrl) // Clean up
          // You might want to notify dApps about connection issues
        }
        ws.onclose = (event) => {
          console.log(
            `WebSocket for subscriptions closed on ${selectedPeer.rpcUrl}:`,
            event
          )
          activeSubscriptionWebSockets.delete(selectedPeer.rpcUrl) // Clean up
          // Remove all subscriptions associated with this closed WS
          subscriptionToPortMap.forEach((value, subId) => {
            if (value.origin === origin) {
              // Assuming one WS per origin for simplicity
              subscriptionToPortMap.delete(subId)
            }
          })
        }

        ws.onmessage = async (event) => {
          const notification = JSON.parse(event.data)
          const message = notification

          // --- NEW: Handle signDigest requests from the server via this WS ---
          if (message.method === "signDigest" && message.params?.digest) {
            const signResponse = await handleSignRequest(
              {
                digest: message.params.digest,
                certificate: message.params.certificate
              },
              origin! // Pass the dApp origin from the subscription request, if relevant. Or the peer's origin.
            )

            if (signResponse.success) {
              ws?.send(
                JSON.stringify({
                  jsonrpc: "2.0",
                  result: { signature: signResponse.signature },
                  id: message.id
                })
              )
            } else {
              ws?.send(
                JSON.stringify({
                  jsonrpc: "2.0",
                  error: {
                    code: -32001,
                    message: signResponse.error || "Signing failed"
                  },
                  id: message.id
                })
              )
            }
          }
          // --- END NEW signDigest handling ---

          // Expected format: { method: "fabric_subscription", params: { subscription: string, result: unknown } }
          else if (
            notification.method === "fabric_subscription" &&
            notification.params?.subscription
          ) {
            const subscriptionId = notification.params.subscription
            const target = subscriptionToPortMap.get(subscriptionId)

            if (target) {
              // Emit the event to the specific dApp that subscribed
              // Using chrome.tabs.sendMessage for targeted emission
              chrome.tabs.sendMessage(
                target.port.sender?.tab?.id!, // Assuming tab.id is available
                {
                  type: "fabric_subscription",
                  result: notification.params, // contains subscriptionId and result
                  kind: "event",
                  from: "background"
                },
                (response) => {
                  if (chrome.runtime.lastError) {
                    console.warn(
                      `Could not send subscription event to tab ${target.port.sender?.tab?.id}:`,
                      chrome.runtime.lastError.message
                    )
                    // If the tab is gone, remove the subscription
                    //subscriptionToPortMap.delete(subscriptionId)
                  }
                }
              )
            } else {
              console.warn(
                `Received subscription notification for unknown ID: ${subscriptionId}`
              )
              // You might want to send an unsubscribe message back to the server
              // for unknown IDs if you don't track them correctly.
            }
          } else {
            // Handle other potential messages from the WebSocket if any (e.g., responses to subscribe calls)
            console.log("Unhandled WebSocket message:", notification)
          }
        }
      }

      // Wait for the WebSocket to open if it's not already
      if (ws.readyState === WebSocket.CONNECTING) {
        await new Promise<void>((resolve, reject) => {
          const openHandler = () => {
            ws.removeEventListener("open", openHandler)
            ws.removeEventListener("error", errorHandler)
            resolve()
          }
          const errorHandler = (event) => {
            ws.removeEventListener("open", openHandler)
            ws.removeEventListener("error", errorHandler)
            reject(new Error("WebSocket connection failed."))
          }
          ws.addEventListener("open", openHandler)
          ws.addEventListener("error", errorHandler)
        })
      }
      if (ws.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket is not open for subscription.")
      }

      const requestId = Math.random().toString(36).substring(2) // Generate a unique request ID for the WS message

      // Now send the subscribe/unsubscribe message
      return new Promise((resolve, reject) => {
        /*const timeout = setTimeout(() => {
          reject(new Error(`${method} request timed out.`))
          ws!.removeEventListener("message", handleResponse)
        }, 30000) // 30-second timeout*/
        let timeoutId

        const handleResponse = (event) => {
          const response = JSON.parse(event.data)
          if (response.id === requestId) {
            //clearTimeout(timeout)
            clearTimeout(timeoutId)
            ws.removeEventListener("message", handleResponse)
            if (response.error) {
              reject(
                new Error(response.error.message || `Error during ${method}`)
              )
            } else {
              const subscriptionId = response.result // Assuming the server returns subscriptionId on successful subscribe

              if (method === "fabric_subscribe" && subscriptionId) {
                // Map the new subscription ID to the requesting dApp's port/origin
                subscriptionToPortMap.set(subscriptionId, {
                  port,
                  origin: origin!
                })
                resolve(subscriptionId) // Return the subscription ID to the dApp
              } else if (method === "fabric_unsubscribe") {
                // Remove the subscription from our map
                const targetSubscriptionId = message.params?.subscriptionId // Assuming unsubscribe takes subscriptionId
                if (targetSubscriptionId) {
                  subscriptionToPortMap.delete(targetSubscriptionId)
                }
                resolve({ success: true })
              } else {
                // Generic success response if no specific subscriptionId is expected/found
                resolve(response.result)
              }
            }
          }
        }

        // Set the timeout *after* adding the listener, so handleResponse can clear it
        timeoutId = setTimeout(() => {
          // This block will only execute if handleResponse hasn't been called yet for this requestId
          ws.removeEventListener("message", handleResponse) // Clean up the listener
          reject(new Error(`${method} request timed out.`)) // Reject the promise
        }, 30000) // 30-second timeout

        ws.addEventListener("message", handleResponse)

        ws.send(
          JSON.stringify({
            jsonrpc: "2.0",
            method: method, // "fabric_subscribe" or "fabric_unsubscribe"
            params: {
              peer: selectedPeer,
              ...(message.params || {}),
              identity: {
                mspId: identityForSubscription.mspId,
                certificate: identityForSubscription.certificate
              }
            },
            id: requestId
          })
        )
      })
    default:
      throw new Error(`Unknown method: ${method}`)
  }
}

/**
 * Opens a popup to request user authorization for a dapp action (e.g., signing, connecting).
 *
 * @param port The connection port used to communicate with the DApp.
 * @param message The request message from the DApp.  The message *must* have an 'id' property.
 * @param type The type of authorization request (e.g., 'sign', 'connect').  This is used in the ui flow.
 * @returns A promise that resolves with the user's response (e.g., the signature, the selected identities) or rejects if the user cancels.
 */
async function openAuthorizationPopup(
  port: chrome.runtime.Port,
  message: any,
  type: string
): Promise<any> {
  const { id } = message
  const origin = port.sender?.origin

  if (!origin) {
    throw new Error("Could not determine the origin of the request.")
  }

  // Save request for the popup to consume
  await chrome.storage.session.set({
    [`pendingRequest_${id}`]: { id, payload: message, type, origin }
  })

  chrome.windows.create({
    url: chrome.runtime.getURL(`popup.html?requestId=${id}`),
    type: "popup",
    width: 360,
    height: 600
  })

  return new Promise((resolve, reject) => {
    pendingRequestResolvers.set(id, { resolve, reject })
  })
}

async function getStoredConnections(): Promise<
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

async function handleIdentitiesRequest(port: chrome.runtime.Port) {
  const origin = port.sender?.origin

  if (!origin) {
    // This case should ideally be handled earlier or indicate a malformed request
    // ideally a port should have an origin
    throw new Error("Could not determine the origin of the request.")
  }

  const storedConnections = await getStoredConnections()
  const connectedIdentities = storedConnections.get(origin) || []

  if (connectedIdentities.length === 0) {
    return []
  }

  const identitiesList = await wallet.list()
  const authorizedIdentities: Identity[] = []

  for (const identityLabel of identitiesList) {
    const connection = connectedIdentities.find(
      (conn) => conn.identityLabel === identityLabel
    )

    if (connection) {
      const identity = await wallet.get(identityLabel)
      if (identity) {
        authorizedIdentities.push({
          label: identity.label,
          mspId: identity.mspId,
          certificate: identity.certificate
        })
      }
    }
  }

  return authorizedIdentities
}
