import { handleConnectionMessage } from "~handlers/connection"
import { handlePortConnection } from "~handlers/port"
import { handleVaultMessage } from "~handlers/vault"
import { handleWalletMessage } from "~handlers/wallet"

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
