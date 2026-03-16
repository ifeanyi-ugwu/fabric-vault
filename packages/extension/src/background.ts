import browser from "webextension-polyfill"

import { handlePortConnection } from "~handlers/port"

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

browser.runtime.onConnect.addListener(handlePortConnection)
