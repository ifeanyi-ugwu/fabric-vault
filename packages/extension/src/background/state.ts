import type Browser from "webextension-polyfill"

import { CryptoManager } from "~lib/crypto"
import { Wallet } from "~lib/wallet"

export const cryptoManager = new CryptoManager()
export const wallet = new Wallet(cryptoManager)
export const connections = new Map<string, Browser.Runtime.Port>()
export const pendingRequestResolvers = new Map<
  string,
  { resolve: Function; reject: Function }
>()

export const activeSubscriptionWebSockets = new Map<string, WebSocket>()

export const subscriptionToPortMap = new Map<
  string,
  { port: Browser.Runtime.Port; origin: string }
>()
