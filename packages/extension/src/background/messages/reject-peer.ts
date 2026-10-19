import type { PlasmoMessaging } from "@plasmohq/messaging"

import { pendingRequestResolvers } from "~background/state"
import { sessionStore } from "~lib/storage"

export type RequestBody = { requestId: string }
export type ResponseBody = { success: boolean }

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  const { requestId } = req.body!
  const resolver = pendingRequestResolvers.get(requestId)
  if (resolver) {
    resolver.reject(new Error("User rejected the peer request"))
    pendingRequestResolvers.delete(requestId)
    await sessionStore.remove(`pendingRequest_${requestId}`)
  }
  res.send({ success: true })
}

export default handler
