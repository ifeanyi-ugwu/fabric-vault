import fabricVaultIconUrl from "data-base64:assets/icon.png"

window.fabric = {
  request: (payload) => {
    return new Promise((resolve, reject) => {
      const id = generateId()

      // Listener to receive response from the background script
      const listener = (event) => {
        const msg = event.data
        // **check if the message is NOT from the webpage itself**
        if (
          event.source !== window ||
          !msg ||
          msg.from === "webpage" ||
          msg.kind !== "response" ||
          msg.id !== id
        ) {
          return
        }

        window.removeEventListener("message", listener)

        if (msg.error) {
          reject(msg.error)
        } else {
          resolve(msg.result)
        }
      }

      window.addEventListener("message", listener)

      // Send request to content script to forward to background
      window.postMessage(
        {
          id,
          method: payload.method,
          params: payload.params,
          from: "webpage",
          kind: "request"
        },
        "*"
      )
    })
  },
  on(event, handler) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set())
    }
    listeners.get(event)?.add(handler)
    return this
  },
  removeListener(event, handler) {
    const eventListeners = listeners.get(event)
    if (eventListeners) {
      eventListeners.delete(handler)
    }
    return this
  }
  //isFabricVault: true
}

// ** Fabric Provider Discovery Logic**

const fabricProviderInfo: FabricProviderInfo = {
  uuid: generateId(),
  name: "Fabric Vault",
  icon: fabricVaultIconUrl,
  rdns: "dev.ifeanyiugwu.fabricvault"
}

// Announce the provider when it's ready
function announceFabricProvider() {
  const detail: FabricAnnounceProviderDetail = {
    info: fabricProviderInfo,
    provider: window.fabric
  }
  window.dispatchEvent(new CustomEvent("fabric:announceProvider", { detail }))
}

// Listen for requests from dapps to announce the provider
window.addEventListener(
  "fabric:requestProvider",
  () => {
    announceFabricProvider()
  },
  { once: true } // Only respond to the first request to avoid spamming, subsequent requests on a single page load might not be needed
)

// Announce provider immediately when it's injected
announceFabricProvider()

function generateId() {
  return `fab-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const listeners = new Map()

// Listen for push events from the extension to dispatch to .on() handlers
window.addEventListener("message", (event) => {
  const msg = event.data
  if (
    event.source !== window ||
    !msg ||
    msg.from === "webpage" ||
    msg.kind !== "event"
  )
    return

  // Dispatch custom events to registered listeners
  const { type, result } = msg
  if (type && listeners.has(type)) {
    listeners.get(type)?.forEach((handler) => handler(result))
  }
})
