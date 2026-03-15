import browser from "webextension-polyfill"

import { handleConnectionMessage } from "~handlers/connection"
import { handlePortConnection } from "~handlers/port"
import { handleVaultMessage } from "~handlers/vault"
import { handleWalletMessage } from "~handlers/wallet"

/**
 * Keep service worker alive to maintain WebSocket connections for dApp subscriptions.
 *
 * MV3 service workers terminate after 30s of inactivity, which closes WebSocket connections
 * and breaks active subscriptions. Since subscriptions require persistent connections and
 * there's no way to resume WebSocket state after service worker restart, we must prevent
 * termination while subscriptions are active.
 */

const KEEP_ALIVE_INTERVAL = 25 * 1000 // 25 seconds

const keepAlive = setInterval(async () => {
  try {
    await browser.runtime.getPlatformInfo()
  } catch (_) {}
}, KEEP_ALIVE_INTERVAL)

self.addEventListener("beforeunload", () => {
  clearInterval(keepAlive)
})

// Returns the response value directly so webextension-polyfill can send it back
// to the caller. The sendResponse callback pattern is incompatible with async
// listeners — the polyfill uses the Promise's resolved value as the response.
const messageRouter = async (request: any, sender: any) => {
  const vaultResult = await handleVaultMessage(request, sender)
  if (vaultResult !== undefined) return vaultResult

  const walletResult = await handleWalletMessage(request, sender)
  if (walletResult !== undefined) return walletResult

  const connectionResult = await handleConnectionMessage(request, sender)
  if (connectionResult !== undefined) return connectionResult
}

browser.runtime.onMessage.addListener(messageRouter)
browser.runtime.onConnect.addListener(handlePortConnection)
