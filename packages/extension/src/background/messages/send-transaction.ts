import type { PlasmoMessaging } from "@plasmohq/messaging"

import { pendingRequests } from "~background/state"
import type { Identity } from "~contexts/identity"
import type { Peer } from "~contexts/peer"
import type { RequestData } from "~contexts/request"
import { ensureWalletReady } from "~services/session"
import { handleSendRequest } from "~services/transaction"

export type RequestBody = {
  peer: Peer
  identity: Identity
  request: RequestData
}
export type ResponseBody = {
  success: boolean
  message?: string
  error?: string
}

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  if (!(await ensureWalletReady())) {
    res.send({ success: false, error: "Wallet is locked." })
    return
  }

  const { peer, identity, request } = req.body!
  if (!pendingRequests.has(request.id)) {
    console.error(`No pending request found for ID: ${request.id}`)
  }
  // The user has answered. The transaction can outlast the popup, which closes
  // right after this, so closing it must not cancel the request.
  pendingRequests.answered(request.id)

  handleSendRequest(peer, identity, request)
    .then((result) => {
      console.log("Transaction completed successfully in background:", result)
      pendingRequests.resolve(request.id, result)
    })
    .catch((error) => {
      console.error("Transaction failed in background:", error)
      pendingRequests.reject(
        request.id,
        error instanceof Error ? error : new Error(String(error))
      )
    })

  res.send({ success: true, message: "Transaction initiation requested." })
}

export default handler
