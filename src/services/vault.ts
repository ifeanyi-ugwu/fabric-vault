import { cryptoManager, wallet } from "~background/state"
import { SESSION_KEYS, STORAGE_KEYS } from "~constants"
import { CryptoManager } from "~lib/crypto"
import {
  clearSessionData,
  getLocalData,
  removeLocalData,
  setLocalData,
  setSessionData
} from "~lib/storage"
import { Wallet, type PrivateIdentity } from "~lib/wallet"

import {
  getSessionUnlockStatus,
  restoreCryptoManagerFromSession
} from "./session"

export const handleUnlock = async (password: string) => {
  //NB: this structure makes providing the current password unnecessary
  //TODO: accept the current password as an arg and check that it is valid before going on with the password change
  // Check if wallet is unlocked via session
  try {
    const storedSalt = (await getLocalData(STORAGE_KEYS.FABRIC_WALLET_SALT))[
      STORAGE_KEYS.FABRIC_WALLET_SALT
    ]
    if (!storedSalt) {
      throw new Error(
        "No salt found. Wallet might not be initialized correctly."
      )
    }

    const { key } = await cryptoManager.deriveKey(password, storedSalt)
    const verificationToken = (
      await getLocalData(STORAGE_KEYS.VERIFICATION_TOKEN)
    )[STORAGE_KEYS.VERIFICATION_TOKEN]

    try {
      await cryptoManager.decrypt(verificationToken)
    } catch {
      throw new Error("Invalid password.")
    }

    await setSessionData({
      [SESSION_KEYS.WALLET_UNLOCKED]: true,
      [SESSION_KEYS.DERIVED_KEY]: key,
      [SESSION_KEYS.SALT]: storedSalt
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const handleLock = async () => {
  await clearSessionData()
  cryptoManager.clearKey()
  return { success: true }
}

export const getUnlockedStatus = async () => {
  const isUnlocked = await getSessionUnlockStatus()
  // If session says it's unlocked, ensure crypto manager is restored
  if (isUnlocked) {
    const restored = await restoreCryptoManagerFromSession()
    if (!restored) {
      // Session corrupted, clear it
      await clearSessionData()
      return { isUnlocked: false }
    }
  }
  return { isUnlocked }
}

export const handleCreateVault = async (password: string) => {
  try {
    // Clear old salt, verification token and session
    await removeLocalData([
      STORAGE_KEYS.FABRIC_WALLET_SALT,
      STORAGE_KEYS.VERIFICATION_TOKEN
    ])
    await clearSessionData()

    // Remove existing wallets identities
    const existingLabels = await wallet.list()
    const removalPromises = existingLabels.map((label) => wallet.remove(label))
    await Promise.all(removalPromises)

    // Set new salt and derive new encryption key
    const { salt } = await cryptoManager.deriveKey(password)
    await setLocalData({ [STORAGE_KEYS.FABRIC_WALLET_SALT]: salt })

    // Encrypt a new verification token
    const verificationToken = await cryptoManager.encrypt("LOCKED")
    await setLocalData({ [STORAGE_KEYS.VERIFICATION_TOKEN]: verificationToken })

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const handleChangePassword = async (newPassword: string) => {
  try {
    const isUnlocked = await getSessionUnlockStatus()
    if (!isUnlocked) {
      throw new Error("Wallet is locked.")
    }

    await restoreCryptoManagerFromSession()

    // Decrypt all identities with the OLD key
    const labels = await wallet.list()
    const identityPromises = labels.map((label) =>
      wallet.getPrivateIdentity(label)
    )
    const decryptedIdentities = (await Promise.all(identityPromises)).filter(
      (id): id is PrivateIdentity => id !== undefined
    )

    // Create a NEW crypto manager with the new password
    const newCryptoManager = new CryptoManager()
    const { salt: newSalt, key: newKey } =
      await newCryptoManager.deriveKey(newPassword)
    // Create a new wallet instance with the NEW crypto manager
    const newWallet = new Wallet(newCryptoManager)

    // Re-encrypt and store all identities using the NEW wallet/key
    const reEncryptPromises = decryptedIdentities.map((identity) => {
      return newWallet.put(identity)
    })
    await Promise.all(reEncryptPromises)

    // Store the new salt in local storage
    await setLocalData({ [STORAGE_KEYS.FABRIC_WALLET_SALT]: newSalt })

    // Create new verification token with the new key
    const verificationToken = await newCryptoManager.encrypt("LOCKED")
    await setLocalData({ [STORAGE_KEYS.VERIFICATION_TOKEN]: verificationToken })

    // Update session with new key
    await setSessionData({
      [SESSION_KEYS.WALLET_UNLOCKED]: true,
      [SESSION_KEYS.DERIVED_KEY]: newKey,
      [SESSION_KEYS.SALT]: newSalt
    })

    // Replace the global crypto manager instance/ switch to new crypto manager
    cryptoManager.clearKey()
    await cryptoManager.restoreKey(newKey, newSalt)

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const hasVault = async () => {
  const result = await getLocalData(STORAGE_KEYS.VERIFICATION_TOKEN)
  return !!result[STORAGE_KEYS.VERIFICATION_TOKEN]
}
