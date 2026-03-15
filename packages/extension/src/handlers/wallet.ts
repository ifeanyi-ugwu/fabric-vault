import browser from "webextension-polyfill"

import { pendingRequestResolvers } from "~background/state"
import { ensureWalletReady } from "~services/session"
import { handleSendRequest } from "~services/transaction"
import { addIdentity, getIdentities, removeIdentity } from "~services/wallet"

export const handleWalletMessage = async (request: any, _sender: any) => {
  const isWalletReady = await ensureWalletReady()

  if (!isWalletReady) {
    if (
      [
        "ADD_IDENTITY_REQUEST",
        "REMOVE_IDENTITY_REQUEST",
        "GET_IDENTITIES_REQUEST"
      ].includes(request.type)
    ) {
      return { success: false, error: "Wallet is locked." }
    }
    return undefined
  }

  switch (request.type) {
    case "ADD_IDENTITY_REQUEST":
      try {
        await addIdentity(request.payload.identity)
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }

    case "REMOVE_IDENTITY_REQUEST":
      try {
        await removeIdentity(request.payload.label)
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }

    case "GET_IDENTITIES_REQUEST":
      try {
        const identities = await getIdentities()
        return { success: true, identities }
      } catch (error) {
        return { success: false, error: error.message }
      }

    case "SEND_TRANSACTION_REQUEST": {
      const { peer, identity, request: req } = request.payload
      const resolver = pendingRequestResolvers.get(req.id)
      if (!resolver) {
        console.error(`No resolver found for pending request ID: ${req.id}`)
      }

      handleSendRequest(peer, identity, req)
        .then((result) => {
          console.log("Transaction completed successfully in background:", result)
          resolver?.resolve(result)
        })
        .catch((error) => {
          console.error("Transaction failed in background:", error)
          resolver?.reject(error)
        })
        .finally(() => {
          if (pendingRequestResolvers.has(request.id)) {
            pendingRequestResolvers.delete(request.id)
            browser.storage.local.remove(`pendingRequest_${request.id}`)
          }
        })

      return { success: true, message: "Transaction initiation requested." }
    }

    default:
      return undefined
  }
}
