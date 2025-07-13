import { handleConnectionMessage } from "~handlers/connection"
import { handlePortConnection } from "~handlers/port"
import { handleVaultMessage } from "~handlers/vault"
import { handleWalletMessage } from "~handlers/wallet"

/**
 * Vault/Wallet session management using chrome.storage.session
 * This approach keeps the wallet unlocked for the browser session without needing to keep the service worker alive
 * Important: Vault/Wallet must be unlocked to perform any operation involving user identity
 */

/**
 * Keep service worker alive to maintain WebSocket connections for dApp subscriptions.
 *
 * MV3 service workers terminate after 30s of inactivity, which closes WebSocket connections
 * and breaks active subscriptions. Since subscriptions require persistent connections and
 * there's no way to resume WebSocket state after service worker restart, we must prevent
 * termination while subscriptions are active.
 */

const KEEP_ALIVE_INTERVAL = 25 * 1000 // 25 seconds

const keepAlive = setInterval(() => {
  chrome.runtime.getPlatformInfo(() => {
    if (chrome.runtime.lastError) {
      console.log("Keep alive ping error:", chrome.runtime.lastError)
    } else {
      console.log("Keep alive ping successful")
    }
  })
}, KEEP_ALIVE_INTERVAL)

self.addEventListener("beforeunload", () => {
  clearInterval(keepAlive)
})

const messageRouter = async (request: any, sender: any, sendResponse: any) => {
  // Try vault handlers first
  const vaultHandled = await handleVaultMessage(request, sender, sendResponse)
  if (vaultHandled) return true

  // Then try wallet handlers
  const walletHandled = await handleWalletMessage(request, sender, sendResponse)
  if (walletHandled) return true

  // Then try connection handlers
  const connectionHandled = await handleConnectionMessage(
    request,
    sender,
    sendResponse
  )
  if (connectionHandled) return true

  return false
}

chrome.runtime.onMessage.addListener(messageRouter)
chrome.runtime.onConnect.addListener(handlePortConnection)
