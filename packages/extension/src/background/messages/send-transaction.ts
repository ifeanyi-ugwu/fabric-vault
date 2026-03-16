import type { PlasmoMessaging } from "@plasmohq/messaging"
import browser from "webextension-polyfill"

import type { Identity } from "~contexts/identity"
import type { Peer } from "~contexts/peer"
import type { RequestData } from "~contexts/request"
import { pendingRequestResolvers } from "~background/state"
import { ensureWalletReady } from "~services/session"
import { handleSendRequest } from "~services/transaction"

export type RequestBody = { peer: Peer; identity: Identity; request: RequestData }
export type ResponseBody = { success: boolean; message?: string; error?: string }

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  if (!(await ensureWalletReady())) {
    res.send({ success: false, error: "Wallet is locked." })
    return
  }

  const { peer, identity, request } = req.body!
  const resolver = pendingRequestResolvers.get(request.id)
  if (!resolver) {
    console.error(`No resolver found for pending request ID: ${request.id}`)
  }

  handleSendRequest(peer, identity, request)
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

  res.send({ success: true, message: "Transaction initiation requested." })
}

export default handler
