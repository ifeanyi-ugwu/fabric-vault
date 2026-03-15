import { cryptoManager } from "~background/state"
import { SESSION_KEYS } from "~constants"
import { sessionStore } from "~lib/storage"

export const getSessionUnlockStatus = async (): Promise<boolean> => {
  return (await sessionStore.get(SESSION_KEYS.WALLET_UNLOCKED)) === true
}

export const restoreCryptoManagerFromSession = async (): Promise<boolean> => {
  try {
    const derivedKey = await sessionStore.get(SESSION_KEYS.DERIVED_KEY)
    const salt = await sessionStore.get(SESSION_KEYS.SALT)

    if (derivedKey && salt) {
      await cryptoManager.restoreKey(derivedKey, salt)
      return true
    }
    return false
  } catch (error) {
    console.error("Failed to restore crypto manager from session:", error)
    return false
  }
}

export const ensureWalletReady = async (): Promise<boolean> => {
  const isUnlocked = await getSessionUnlockStatus()
  if (!isUnlocked) {
    return false
  }
  return await restoreCryptoManagerFromSession()
}
