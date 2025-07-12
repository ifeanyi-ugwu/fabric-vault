import {
  activeSubscriptionWebSockets,
  connections,
  pendingRequestResolvers,
  subscriptionToPortMap,
  wallet
} from "~background/state"
import type { Identity } from "~contexts/identity"
import { getStoredConnections } from "~services/connection"
import { handleSignRequest } from "~services/wallet"

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

  // 1. Determine the intended identity for the transaction/action
  if (identity) {
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
      identityToUseForConnection.label = identity.label
      console.log("Using label from message:", identity.label)
    }
  } else {
    // If no identity explicitly provided by dApp, use the currently active one
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

  // 2. Check if there's any identity identified to use
  if (
    !identityToUseForConnection.label &&
    !identityToUseForConnection.certificate
  ) {
    throw new Error(
      "No identity specified by DApp and no active identity set. Please select or provide an identity."
    )
  }

  // 3. Validate if the site is connected to this intended identity
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

async function handleIdentitiesRequest(port: chrome.runtime.Port) {
  const origin = port.sender?.origin
  if (!origin) {
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

// Main request handler for port messages
async function handlePortRequest(message: any, port: chrome.runtime.Port) {
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
      return await handleSubscriptionRequest(message, port, origin!)

    default:
      throw new Error(`Unknown method: ${method}`)
  }
}

async function handleSubscriptionRequest(
  message: any,
  port: chrome.runtime.Port,
  origin: string
) {
  const { method } = message

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
    ws = await createWebSocketConnection(selectedPeer.rpcUrl, origin)
  }

  // Wait for the WebSocket to open if it's not already
  if (ws.readyState === WebSocket.CONNECTING) {
    await waitForWebSocketOpen(ws)
  }

  if (ws.readyState !== WebSocket.OPEN) {
    throw new Error("WebSocket is not open for subscription.")
  }

  const requestId = Math.random().toString(36).substring(2)

  return new Promise((resolve, reject) => {
    let timeoutId
    const handleResponse = (event) => {
      const response = JSON.parse(event.data)
      if (response.id === requestId) {
        clearTimeout(timeoutId)
        ws.removeEventListener("message", handleResponse)

        if (response.error) {
          reject(new Error(response.error.message || `Error during ${method}`))
        } else {
          const subscriptionId = response.result
          if (method === "fabric_subscribe" && subscriptionId) {
            // Map the new subscription ID to the requesting dApp's port/origin
            subscriptionToPortMap.set(subscriptionId, {
              port,
              origin: origin!
            })
            resolve(subscriptionId) // Return the subscription ID to the dApp
          } else if (method === "fabric_unsubscribe") {
            const targetSubscriptionId = message.params?.subscriptionId
            if (targetSubscriptionId) {
              subscriptionToPortMap.delete(targetSubscriptionId)
            }
            resolve({ success: true })
          } else {
            // this ideally will not be reached
            resolve(response.result)
          }
        }
      }
    }

    // Set the timeout *after* adding the listener, so handleResponse can clear it
    timeoutId = setTimeout(() => {
      // This block will only execute if handleResponse hasn't been called yet for this requestId
      ws.removeEventListener("message", handleResponse)
      reject(new Error(`${method} request timed out.`))
    }, 30000)

    ws.addEventListener("message", handleResponse)
    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        method: method,
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
}

async function createWebSocketConnection(
  rpcUrl: string,
  origin: string
): Promise<WebSocket> {
  const ws = new WebSocket(rpcUrl)
  activeSubscriptionWebSockets.set(rpcUrl, ws)

  ws.onopen = () => {
    console.log(`WebSocket for subscriptions connected to ${rpcUrl}`)
  }

  ws.onerror = (event) => {
    console.error(`WebSocket for subscriptions error on ${rpcUrl}:`, event)
    activeSubscriptionWebSockets.delete(rpcUrl)
  }

  ws.onclose = (event) => {
    console.log(`WebSocket for subscriptions closed on ${rpcUrl}:`, event)
    activeSubscriptionWebSockets.delete(rpcUrl)
    // Remove all subscriptions associated with this closed WS
    subscriptionToPortMap.forEach((value, subId) => {
      if (value.origin === origin) {
        // Assuming one WS per origin
        subscriptionToPortMap.delete(subId)
      }
    })
  }

  ws.onmessage = async (event) => {
    const notification = JSON.parse(event.data)
    const message = notification

    // Handle signDigest requests from the server via this WS
    if (message.method === "signDigest" && message.params?.digest) {
      const signResponse = await handleSignRequest(
        {
          digest: message.params.digest,
          certificate: message.params.certificate
        },
        origin
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
    // Handle subscription notifications
    else if (
      notification.method === "fabric_subscription" &&
      notification.params?.subscription
    ) {
      const subscriptionId = notification.params.subscription
      const target = subscriptionToPortMap.get(subscriptionId)

      if (target) {
        // Emit the event to the specific dApp that subscribed
        chrome.tabs.sendMessage(
          target.port.sender?.tab?.id!,
          {
            type: "fabric_subscription",
            result: notification.params,
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
        // but this block, ideally, will not be reachable
      }
    } else {
      console.log("Unhandled WebSocket message:", notification)
    }
  }

  return ws
}

async function waitForWebSocketOpen(ws: WebSocket): Promise<void> {
  return new Promise<void>((resolve, reject) => {
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

// Main port connection handler
export const handlePortConnection = (port: chrome.runtime.Port) => {
  if (port.name !== "fabric") return

  const portRequestIds = new Set<string>()
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

  // Cleanup on disconnect
  port.onDisconnect.addListener(() => {
    //this check for name is because of plasmo's port that's almost frequently connecting and disconnecting during development
    if (port.name !== "fabric") return

    // Cleanup pending requests associated with this por
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

    // Clean up subscriptions for this disconnected port
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
}
