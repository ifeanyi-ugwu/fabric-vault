import { wallet } from "~background/state"
import type { Identity } from "~contexts/identity"
import type { PrivateIdentity } from "~lib/wallet"

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

export const handleSignRequest = async (message: any, senderOrigin: string) => {
  const { digest, certificate } = message
  if (!certificate) {
    return { success: false, error: "Certificate not provided for signing." }
  }
  //this relied on label, find a way to do this check with only certificate
  /*if (
    !senderOrigin ||
    !(await isConnectedToIdentity(senderOrigin, certificate))
  ) {
    return {
      success: false,
      error: "Site is not connected to the requested identity."
    }
  }*/
  //TODO: implement this check since we now have a certificate index

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
