import { wallet } from "~background/state"
import type { Identity } from "~contexts/identity"
import type { PrivateIdentity } from "~lib/wallet"

import { isConnectedToIdentity } from "./connection"

export const addIdentity = async (identity: PrivateIdentity) => {
  await wallet.put(identity)
}

export const removeIdentity = async (label: string) => {
  await wallet.remove(label)
}

export const getIdentities = async (): Promise<Identity[]> => {
  const labels = await wallet.list()
  const identityPromises = labels.map((label) => wallet.get(label))
  const fullIdentities = await Promise.all(identityPromises)

  return fullIdentities
    .filter((identity): identity is Identity => Boolean(identity))
    .map((identity) => ({
      label: identity.label,
      mspId: identity.mspId,
      certificate: identity.certificate
    }))
}

/**
 * Signs a digest for a certificate on behalf of a site. The site must be
 * connected to the identity that owns the certificate, so a gateway cannot
 * obtain a signature for an identity the site was never granted.
 */
export const handleSignRequest = async (message: any, senderOrigin: string) => {
  const { digest, certificate } = message
  if (!certificate) {
    return { success: false, error: "Certificate not provided for signing." }
  }

  const label = await wallet.getLabelByCertificate(certificate)
  if (!label) {
    return { success: false, error: "Identity not found in wallet." }
  }
  if (!(await isConnectedToIdentity(senderOrigin, label))) {
    return {
      success: false,
      error: "Site is not connected to the requested identity."
    }
  }

  try {
    const signature = await wallet.sign(digest, certificate)
    return { success: true, signature }
  } catch (error) {
    console.error("Error signing transaction:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
