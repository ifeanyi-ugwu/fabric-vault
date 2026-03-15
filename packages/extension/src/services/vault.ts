import browser from "webextension-polyfill"

import { cryptoManager, wallet } from "~background/state"
import { SESSION_KEYS, STORAGE_KEYS } from "~constants"
import { CryptoManager } from "~lib/crypto"
import { sessionStore } from "~lib/storage"
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
    const storedSalt = (
      await browser.storage.local.get(STORAGE_KEYS.FABRIC_WALLET_SALT)
    )[STORAGE_KEYS.FABRIC_WALLET_SALT]
    if (!storedSalt) {
      throw new Error(
        "No salt found. Wallet might not be initialized correctly."
      )
    }

    const { key } = await cryptoManager.deriveKey(password, storedSalt)
    const verificationToken = (
      await browser.storage.local.get(STORAGE_KEYS.VERIFICATION_TOKEN)
    )[STORAGE_KEYS.VERIFICATION_TOKEN]

    try {
      await cryptoManager.decrypt(verificationToken)
    } catch {
      throw new Error("Invalid password.")
    }

    await sessionStore.set(SESSION_KEYS.WALLET_UNLOCKED, true)
    await sessionStore.set(SESSION_KEYS.DERIVED_KEY, key)
    await sessionStore.set(SESSION_KEYS.SALT, storedSalt)

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const handleLock = async () => {
  await sessionStore.clear()
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
      await sessionStore.clear()
      return { isUnlocked: false }
    }
  }
  return { isUnlocked }
}

export const handleCreateVault = async (password: string) => {
  try {
    // Clear old salt, verification token and session
    await browser.storage.local.remove([
      STORAGE_KEYS.FABRIC_WALLET_SALT,
      STORAGE_KEYS.VERIFICATION_TOKEN
    ])
    await sessionStore.clear()

    // Remove existing wallets identities
    const existingLabels = await wallet.list()
    const removalPromises = existingLabels.map((label) => wallet.remove(label))
    await Promise.all(removalPromises)

    // Set new salt and derive new encryption key
    const { salt } = await cryptoManager.deriveKey(password)
    await browser.storage.local.set({ [STORAGE_KEYS.FABRIC_WALLET_SALT]: salt })

    // Encrypt a new verification token
    const verificationToken = await cryptoManager.encrypt("LOCKED")
    await browser.storage.local.set({
      [STORAGE_KEYS.VERIFICATION_TOKEN]: verificationToken
    })

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
    await browser.storage.local.set({
      [STORAGE_KEYS.FABRIC_WALLET_SALT]: newSalt
    })

    // Create new verification token with the new key
    const verificationToken = await newCryptoManager.encrypt("LOCKED")
    await browser.storage.local.set({
      [STORAGE_KEYS.VERIFICATION_TOKEN]: verificationToken
    })

    // Update session with new key
    await sessionStore.set(SESSION_KEYS.WALLET_UNLOCKED, true)
    await sessionStore.set(SESSION_KEYS.DERIVED_KEY, newKey)
    await sessionStore.set(SESSION_KEYS.SALT, newSalt)

    // Replace the global crypto manager instance/ switch to new crypto manager
    cryptoManager.clearKey()
    await cryptoManager.restoreKey(newKey, newSalt)

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const hasVault = async () => {
  const result = await browser.storage.local.get(STORAGE_KEYS.VERIFICATION_TOKEN)
  return !!result[STORAGE_KEYS.VERIFICATION_TOKEN]
}
