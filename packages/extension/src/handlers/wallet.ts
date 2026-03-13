import { pendingRequestResolvers } from "~background/state"
import { ensureWalletReady } from "~services/session"
import { handleSendRequest } from "~services/transaction"
import { addIdentity, getIdentities, removeIdentity } from "~services/wallet"

export const handleWalletMessage = async (
  request: any,
  sender: any,
  sendResponse: any
) => {
  const origin = sender.origin
  const isWalletReady = await ensureWalletReady()

  if (!isWalletReady) {
    if (
      [
        "ADD_IDENTITY_REQUEST",
        "REMOVE_IDENTITY_REQUEST",
        "GET_IDENTITIES_REQUEST"
      ].includes(request.type)
    ) {
      sendResponse({ success: false, error: "Wallet is locked." })
      return true
    }
    return false
  }

  switch (request.type) {
    case "ADD_IDENTITY_REQUEST":
      try {
        await addIdentity(request.payload.identity)
        sendResponse({ success: true })
      } catch (error) {
        sendResponse({ success: false, error: error.message })
      }
      return true

    case "REMOVE_IDENTITY_REQUEST":
      try {
        await removeIdentity(request.payload.label)
        sendResponse({ success: true })
      } catch (error) {
        sendResponse({ success: false, error: error.message })
      }
      return true

    case "GET_IDENTITIES_REQUEST":
      try {
        const identities = await getIdentities()
        sendResponse({ success: true, identities })
      } catch (error) {
        sendResponse({ success: false, error: error.message })
      }
      return true

    case "SEND_TRANSACTION_REQUEST":
      // Call sendResponse immediately to acknowledge the request
      // and allow the frontend to close the popup.
      // or i can just not await the message request in the popup
      sendResponse({
        success: true,
        message: "Transaction initiation requested."
      })

      try {
        const { peer, identity, request: req } = request.payload
        const resolver = pendingRequestResolvers.get(req.id)
        if (!resolver) {
          console.error(`No resolver found for pending request ID: ${req.id}`)
        }

        await handleSendRequest(peer, identity, req)
          .then((result) => {
            console.log(
              "Transaction completed successfully in background:",
              result
            )
            // Resolve the original promise that the DApp is awaiting
            resolver?.resolve(result)
          })
          .catch((error) => {
            console.error("Transaction failed in background:", error)
            // Reject the original promise that the DApp is awaiting
            resolver?.reject(error)
          })
          .finally(() => {
            // Clean up the pending request resolver and storage after the promise settles
            if (pendingRequestResolvers.has(request.id)) {
              pendingRequestResolvers.delete(request.id)
              chrome.storage.local.remove(`pendingRequest_${request.id}`)
            }
          })
      } catch (error) {
        console.error("Error sending transaction:", error)
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }
      return true

    default:
      return false
  }
}
