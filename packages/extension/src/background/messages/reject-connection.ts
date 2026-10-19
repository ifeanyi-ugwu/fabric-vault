import type { PlasmoMessaging } from "@plasmohq/messaging"

import { pendingRequests } from "~background/state"

export type RequestBody = { requestId: string }
export type ResponseBody = { success: boolean }

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  const { requestId } = req.body!
  pendingRequests.reject(
    requestId,
    new Error("User rejected the connection request")
  )
  res.send({ success: true })
}

export default handler
