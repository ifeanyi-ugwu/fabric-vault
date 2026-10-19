import type Browser from "webextension-polyfill"

import { CryptoManager } from "~lib/crypto"
import { sessionStore } from "~lib/storage"
import { Wallet } from "~lib/wallet"
import { PendingRequests } from "~services/pending-requests"

export const cryptoManager = new CryptoManager()
export const wallet = new Wallet(cryptoManager)
export const connections = new Map<string, Browser.Runtime.Port>()
// Requests waiting on the user. A request nobody answers is dropped after ten
// minutes, and its stored state goes with it however it ends.
export const pendingRequests = new PendingRequests({
  timeoutMs: 10 * 60 * 1000,
  onSettled: (id) => void sessionStore.remove(`pendingRequest_${id}`)
})

export const activeSubscriptionWebSockets = new Map<string, WebSocket>()

export const subscriptionToPortMap = new Map<
  string,
  { port: Browser.Runtime.Port; origin: string }
>()
