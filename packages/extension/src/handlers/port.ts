import type Browser from "webextension-polyfill"
import browser from "webextension-polyfill"

import {
  activeSubscriptionWebSockets,
  connections,
  pendingRequests,
  subscriptionToPortMap,
  wallet
} from "~background/state"
import type { Identity } from "~contexts/identity"
import type { Peer } from "~contexts/peer"
import { SigningSession } from "~lib/fabric/session"
import { assertSecureGatewayUrl } from "~lib/gateway-url"
import { getPortOrigin } from "~lib/origin"
import { parsePeerRequest } from "~lib/peer-request"
import { buildGatewayParams } from "~lib/request-params"
import { sessionStore } from "~lib/storage"
import {
  getStoredConnections,
  isConnected,
  isConnectedToIdentity
} from "~services/connection"
import {
  answerSigningRequest,
  approvedSubscription,
  type SigningContext
} from "~services/signing"
import { SigningGrants } from "~services/signing-grants"
import { handleSignRequest } from "~services/wallet"

async function getActiveIdentityLabel(): Promise<string | null> {
  const identity = (await browser.storage.local.get("selectedIdentity"))[
    "selectedIdentity"
  ] as Identity | undefined
  return identity?.label || null
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
      /*console.log(
        "Derived label from certificate:",
        identityToUseForConnection.label
      )*/
    } else if (identity.label) {
      // Fallback if certificate not provided but label is (less reliable as label isn't unique enough for security usually) originally meant for display
      identityToUseForConnection.label = identity.label
      console.log("Using label from message:", identity.label)
    }
  } else {
    // If no identity explicitly provided by dApp, use the currently active one
    const activeIdentityPublicInfo = (
      await browser.storage.local.get("selectedIdentity")
    )["selectedIdentity"] as Identity | undefined
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
  port: Browser.Runtime.Port,
  message: any,
  type: string
): Promise<any> {
  const { id } = message
  const origin = getPortOrigin(port)
  if (!origin) {
    throw new Error("Could not determine the origin of the request.")
  }

  // Save request for the popup to consume
  await sessionStore.set(`pendingRequest_${id}`, {
    id,
    payload: message,
    type,
    origin
  })

  const answer = pendingRequests.open(id)
  try {
    const popup = await browser.windows.create({
      url: browser.runtime.getURL(`popup.html?requestId=${id}`),
      type: "popup",
      width: 360,
      height: 600
    })
    if (popup.id !== undefined) requestOfPopup.set(popup.id, id)
  } catch (error) {
    pendingRequests.reject(
      id,
      error instanceof Error ? error : new Error(String(error))
    )
  }
  return answer
}

// A popup closed without an answer cancels its request. The popup also closes
// after the user approves, which pendingRequests tells apart.
const requestOfPopup = new Map<number, string>()
browser.windows.onRemoved.addListener((windowId) => {
  const id = requestOfPopup.get(windowId)
  if (id === undefined) return
  requestOfPopup.delete(windowId)
  pendingRequests.popupClosed(id)
})

async function handleIdentitiesRequest(port: Browser.Runtime.Port) {
  const origin = getPortOrigin(port)
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
async function handlePortRequest(message: any, port: Browser.Runtime.Port) {
  const { method } = message
  const origin = getPortOrigin(port)

  switch (method) {
    case "fabric_requestIdentities":
      return await openAuthorizationPopup(port, message, "connect")

    case "fabric_identities":
      return await handleIdentitiesRequest(port)

    case "fabric_peer": {
      const selectedPeer = (await browser.storage.local.get("selectedPeer"))[
        "selectedPeer"
      ] as Peer | undefined
      if (!selectedPeer) throw new Error("No peer is selected.")
      return selectedPeer.endpoint
    }

    case "fabric_requestPeer":
      if (!(await isConnected(origin))) {
        throw new Error("Connect to the wallet before requesting a peer.")
      }
      return await requestPeer(port, message, origin!)

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
          id: message.id,
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

// One peer request per site at a time. The window ends the block if a popup is
// closed without an answer, which leaves its request unsettled.
const PEER_REQUEST_WINDOW_MS = 2 * 60 * 1000
const openPeerRequests = new Map<string, number>()

async function requestPeer(
  port: Browser.Runtime.Port,
  message: any,
  origin: string
) {
  if ((openPeerRequests.get(origin) ?? 0) > Date.now()) {
    throw new Error("A peer request from this site is already open.")
  }
  const peer = parsePeerRequest(message.params)
  openPeerRequests.set(origin, Date.now() + PEER_REQUEST_WINDOW_MS)
  try {
    return await openAuthorizationPopup(
      port,
      { id: message.id, method: message.method, params: peer },
      "peer"
    )
  } finally {
    openPeerRequests.delete(origin)
  }
}

// A subscription starts with one signed event request.
const SUBSCRIBE_SIGNATURES = 1
const SIGNATURE_MARGIN = 1
const SUBSCRIBE_TIMEOUT_MS = 30 * 1000

// The socket for a gateway is shared by every site that subscribes through
// it, so signing rights are tracked per socket and carry the site that
// earned them.
const subscriptionSigningGrants = new WeakMap<
  WebSocket,
  SigningGrants<SigningContext>
>()

function signingGrantsFor(ws: WebSocket): SigningGrants<SigningContext> {
  let grants = subscriptionSigningGrants.get(ws)
  if (!grants) {
    grants = new SigningGrants<SigningContext>()
    subscriptionSigningGrants.set(ws, grants)
  }
  return grants
}

async function handleSubscriptionRequest(
  message: any,
  port: Browser.Runtime.Port,
  origin: string
) {
  const { method } = message

  const identityForSubscription = await determineAndValidateIdentity({
    identity: message.params.identity,
    origin
  })

  const selectedPeer = (await browser.storage.local.get("selectedPeer"))[
    "selectedPeer"
  ] as Peer | undefined
  if (!selectedPeer || !selectedPeer.rpcUrl) {
    throw new Error(
      "No peer selected or peer RPC URL missing for subscription."
    )
  }
  assertSecureGatewayUrl(selectedPeer.rpcUrl)

  // Get or create WebSocket connection for this peer
  let socket = activeSubscriptionWebSockets.get(selectedPeer.rpcUrl)
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    socket = await createWebSocketConnection(selectedPeer.rpcUrl, origin)
  }

  // Wait for the WebSocket to open if it's not already
  if (socket.readyState === WebSocket.CONNECTING) {
    await waitForWebSocketOpen(socket)
  }

  if (socket.readyState !== WebSocket.OPEN) {
    throw new Error("WebSocket is not open for subscription.")
  }

  // Narrowing on `socket` does not carry into the promise callback below.
  const ws = socket

  // The gateway signs the event request when a subscription starts. The
  // grant lets this socket sign for the subscribing site's identity during
  // that request and at no other time.
  if (method === "fabric_subscribe") {
    signingGrantsFor(ws).grant({
      certificate: identityForSubscription.certificate!,
      origin,
      count: SUBSCRIBE_SIGNATURES + SIGNATURE_MARGIN,
      ttlMs: SUBSCRIBE_TIMEOUT_MS,
      context: {
        session: new SigningSession(
          approvedSubscription(message.params, {
            mspId: identityForSubscription.mspId!,
            certificate: identityForSubscription.certificate!
          })
        ),
        allowLegacyDigest: selectedPeer.legacySigning === true
      }
    })
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
    }, SUBSCRIBE_TIMEOUT_MS)

    ws.addEventListener("message", handleResponse)
    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        method: method,
        params: buildGatewayParams(
          message.params,
          {
            mspId: identityForSubscription.mspId!,
            certificate: identityForSubscription.certificate!
          },
          selectedPeer
        ),
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

    // Handle signing requests from the gateway via this WS
    const reply = await answerSigningRequest(
      message,
      signingGrantsFor(ws),
      (digest, certificate, signingOrigin) =>
        handleSignRequest({ digest, certificate }, signingOrigin)
    )
    if (reply) {
      ws?.send(JSON.stringify({ jsonrpc: "2.0", id: message.id, ...reply }))
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
        try {
          await browser.tabs.sendMessage(target.port.sender?.tab?.id!, {
            type: "fabric_subscription",
            result: notification.params,
            kind: "event",
            from: "background"
          })
        } catch (err) {
          console.warn(
            `Could not send subscription event to tab ${target.port.sender?.tab?.id}:`,
            err instanceof Error ? err.message : String(err)
          )
        }
      } else {
        console.warn(
          `Received subscription notification for unknown ID: ${subscriptionId}`
        )
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
export const handlePortConnection = (port: Browser.Runtime.Port) => {
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

    // Cleanup pending requests associated with this port. The dApp's listener
    // goes with the port, so nothing is left to receive a rejection.
    portRequestIds.forEach((requestId) => pendingRequests.forget(requestId))
    portRequestIds.clear()

    // Clean up subscriptions for this disconnected port
    const disconnectedOrigin = getPortOrigin(port)
    console.log(
      `Port disconnected for origin: ${disconnectedOrigin}. Port name: ${port.name}.`
    )

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
