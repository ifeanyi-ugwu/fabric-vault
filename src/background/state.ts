import { CryptoManager } from "~lib/crypto"
import { Wallet } from "~lib/wallet"

export const cryptoManager = new CryptoManager()
export const wallet = new Wallet(cryptoManager)
//export const connections = new Map()
// Track active connections
export const connections = new Map<string, chrome.runtime.Port>()
//export const pendingRequestResolvers = new Map()
export const pendingRequestResolvers = new Map<
  string,
  { resolve: Function; reject: Function }
>()

// Map to hold active WebSocket connections for subscription purposes.
// Key: Peer RPC URL (or a combination of peer and identity if specific to that identity)
// Value: The WebSocket instance
export const activeSubscriptionWebSockets = new Map<string, WebSocket>()

// Map to track which subscription IDs belong to which dApp port/origin
// Key: subscriptionId (from the backend)
// Value: { port: chrome.runtime.Port, origin: string }
export const subscriptionToPortMap = new Map<
  string,
  { port: chrome.runtime.Port; origin: string }
>()
