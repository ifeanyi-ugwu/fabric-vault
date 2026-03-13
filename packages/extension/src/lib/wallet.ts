import type { Identity } from "~/contexts/identity"

import { CryptoManager } from "./crypto"

export type PrivateIdentity = Identity & { privateKey: string }

/**
 * A wallet contains a set of user identities. An application run by a user selects one of these identities when it connects to a channel. Access rights to identity resources, such as the ledger, are determined using this identity in combination with an MSP.
 *
 * A Fabric wallet can hold multiple identities with certificates issued by a different Certificate Authority. Identities comprise certificate, private key and Fabric metadata.
 *
 */
/*interface Wallet {
  identities: {
    [label: string]: IdentityWithPrivateKey
  }
}*/

export class Wallet {
  private identityStorageKeyPrefix = "fabric_identity_public_"
  private privateKeyKeyPrefix = "fabric_identity_private_key_"
  private certificateIndexKey = "fabric_certificate_index"

  constructor(private crypto: CryptoManager) {}

  private identityStorageKey(label: string): string {
    return `${this.identityStorageKeyPrefix}${label}`
  }

  private identityPrivateKeyStorageKey(label: string): string {
    return `${this.privateKeyKeyPrefix}${label}`
  }

  // --- Internal Index Management (for efficient lookups by certificate) ---

  /**
   * Retrieves the current certificate index from storage.
   * The index maps certificate hashes to identity labels.
   * @returns A promise resolving to the certificate index object.
   */
  private async getCertificateIndex(): Promise<Record<string, string>> {
    try {
      const result = await chrome.storage.local.get(this.certificateIndexKey)
      return JSON.parse(result[this.certificateIndexKey] || "{}")
    } catch (e) {
      console.error("Error parsing certificate index, returning empty:", e)
      return {}
    }
  }

  async get(label: string): Promise<Identity | undefined> {
    const key = this.identityStorageKey(label)
    const result = await chrome.storage.local.get(key)
    const publicStr = result[key]
    if (!publicStr) {
      return
    }

    try {
      return JSON.parse(publicStr) as Identity
    } catch (e) {
      console.error(`Error parsing public identity for label '${label}':`, e)
      return
    }
  }

  async put(identity: PrivateIdentity): Promise<void> {
    const newCertHash = await sha256(identity.certificate)
    const index = await this.getCertificateIndex()

    // Prevent adding if certificate already exists under a DIFFERENT label
    const existingLabelForCert = index[newCertHash]
    if (existingLabelForCert && existingLabelForCert !== identity.label) {
      throw new Error(
        `Certificate already exists in wallet under label: '${existingLabelForCert}'. Cannot add same certificate with label: '${identity.label}'.`
      )
    }

    // Prepare Public Identity (unencrypted)
    const publicIdentity: Identity = {
      label: identity.label,
      mspId: identity.mspId,
      certificate: identity.certificate
    }
    const plainPublicIdentity = JSON.stringify(publicIdentity)

    // Prepare Encrypted Private Key
    const encryptedPrivateKey = await this.crypto.encrypt(identity.privateKey)
    const plainEncryptedPrivateKey = JSON.stringify(encryptedPrivateKey)

    // Get old certificate hash for cleanup (if identity with this label existed)
    const oldPublicIdentity = await this.get(identity.label)
    let oldCertHash: string | undefined
    if (oldPublicIdentity && oldPublicIdentity.certificate) {
      oldCertHash = await sha256(oldPublicIdentity.certificate)
    }

    // Storage payload to be set atomically
    const storagePayload: Record<string, string> = {
      [this.identityStorageKey(identity.label)]: plainPublicIdentity,
      [this.identityPrivateKeyStorageKey(identity.label)]:
        plainEncryptedPrivateKey
    }

    // Clean up old certificate hash from the index if it exists and is different
    if (oldCertHash && oldCertHash !== newCertHash) {
      if (index[oldCertHash] === identity.label) {
        delete index[oldCertHash]
      }
    }

    // Add/update mapping for the new certificate in the index
    index[newCertHash] = identity.label
    storagePayload[this.certificateIndexKey] = JSON.stringify(index)

    // Perform a single, atomic set operation for all changes
    await chrome.storage.local.set(storagePayload)
  }

  async remove(label: string): Promise<void> {
    // First, retrieve the identity to get its certificate for index removal
    const identity = await this.get(label)
    let certHashToRemove: string | undefined = undefined
    if (identity && identity.certificate) {
      certHashToRemove = await sha256(identity.certificate)
    }

    let updatedIndex: Record<string, string> | undefined

    // If an identity was found and had a certificate, update the index
    if (certHashToRemove) {
      try {
        const currentIndex = await this.getCertificateIndex()
        if (currentIndex[certHashToRemove] === label) {
          // Only delete if it maps to this specific label
          delete currentIndex[certHashToRemove]
        }
        updatedIndex = currentIndex
      } catch (err) {
        console.warn(
          `Failed to update certificate index during removal for label '${label}': ${(err as Error).message}`
        )
      }
    }

    // Remove both public and private parts
    const publicIdentityKey = this.identityStorageKey(label)
    const privateKeyKey = this.identityPrivateKeyStorageKey(label)
    const keysToRemove = [publicIdentityKey, privateKeyKey]

    await chrome.storage.local.remove(keysToRemove)

    // If the index needed updating (i.e., certHashToRemove was found and index was modified)
    if (updatedIndex) {
      const obj: Record<string, string> = {
        [this.certificateIndexKey]: JSON.stringify(updatedIndex)
      }
      await chrome.storage.local.set(obj)
    }
    // Note: If updatedIndex was undefined, it means no index update was needed (identity not found, or no cert).
  }

  async list(): Promise<string[]> {
    const items = await chrome.storage.local.get(null)
    const keys = Object.keys(items).filter((k) =>
      k.startsWith(this.identityStorageKeyPrefix)
    )
    return keys.map((k) => k.replace(this.identityStorageKeyPrefix, ""))
  }

  private async getPrivateKey(label: string): Promise<string | undefined> {
    const privateKeyEncryptedStr = (
      await chrome.storage.local.get(this.identityPrivateKeyStorageKey(label))
    )[this.identityPrivateKeyStorageKey(label)]
    if (!privateKeyEncryptedStr) {
      console.warn(`No encrypted private key found for identity '${label}'.`)
      return
    }

    try {
      const encryptedPrivateKey = JSON.parse(privateKeyEncryptedStr)
      const decryptedPrivateKey = await this.crypto.decrypt(encryptedPrivateKey) // This will throw if wallet is locked

      return decryptedPrivateKey
    } catch (err) {
      console.warn(
        `Failed to decrypt private key for identity '${label}': ${(err as Error).message}`
      )
      return
    }
  }

  async sign(digestBase64: string, certificate: string): Promise<string> {
    const label = await this.getLabelByCertificate(certificate)
    if (!label) {
      throw new Error("Identity not found in wallet")
    }

    const privateKeyPem = await this.getPrivateKey(label)
    if (!privateKeyPem) {
      throw new Error("Private key is missing from the identity")
    }

    return await this.crypto.sign(digestBase64, privateKeyPem)
  }

  /**
   * Retrieves the label of an identity by its certificate, without attempting decryption.
   * This method uses an internal index for efficient lookups and is safe to call
   * when the wallet might be locked, as it only accesses the non-encrypted index.
   * @param certificate The certificate string of the identity to retrieve the label for.
   * @returns The label string if found, otherwise undefined.
   */
  async getLabelByCertificate(
    certificate: string
  ): Promise<string | undefined> {
    const certHash = await sha256(certificate)
    const index = await this.getCertificateIndex()
    return index[certHash]
  }

  /**
   * Retrieves a PrivateIdentity (public components + decrypted private key).
   * This method requires the wallet to be unlocked.
   * @param label The label of the identity.
   * @returns The PrivateIdentity object if found and wallet is unlocked, otherwise undefined.
   */
  async getPrivateIdentity(
    label: string
  ): Promise<PrivateIdentity | undefined> {
    const publicIdentity = await this.get(label)
    if (!publicIdentity) {
      return
    }

    // Attempt to get the decrypted private key. This will fail if the wallet is locked.
    const privateKey = await this.getPrivateKey(label)
    if (!privateKey) {
      // This means the private key couldn't be decrypted (e.g., wallet locked)
      // or it was missing.
      console.warn(
        `Failed to retrieve decrypted private key for identity '${label}'.`
      )
      return undefined
    }

    return {
      ...publicIdentity,
      privateKey: privateKey
    }
  }
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message) // Encode as UTF-8
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer) // Hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)) // Convert buffer to byte array
  const hexHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("") // Convert bytes to hex string
  return hexHash
}
