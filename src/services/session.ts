import { cryptoManager } from "~background/state"
import { SESSION_KEYS } from "~constants"
import { getSessionData } from "~lib/storage"

export const getSessionUnlockStatus = async (): Promise<boolean> => {
  const result = await getSessionData(SESSION_KEYS.WALLET_UNLOCKED)
  return result[SESSION_KEYS.WALLET_UNLOCKED] === true
}

export const restoreCryptoManagerFromSession = async (): Promise<boolean> => {
  try {
    const sessionData = await getSessionData([
      SESSION_KEYS.DERIVED_KEY,
      SESSION_KEYS.SALT
    ])

    if (
      sessionData[SESSION_KEYS.DERIVED_KEY] &&
      sessionData[SESSION_KEYS.SALT]
    ) {
      await cryptoManager.restoreKey(
        sessionData[SESSION_KEYS.DERIVED_KEY],
        sessionData[SESSION_KEYS.SALT]
      )
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
