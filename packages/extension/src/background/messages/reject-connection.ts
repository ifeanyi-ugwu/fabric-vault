import type { PlasmoMessaging } from "@plasmohq/messaging"
import browser from "webextension-polyfill"

import { pendingRequestResolvers } from "~background/state"

export type RequestBody = { requestId: string }
export type ResponseBody = { success: boolean }

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  const { requestId } = req.body!
  const resolver = pendingRequestResolvers.get(requestId)
  if (resolver) {
    resolver.reject(new Error("User rejected the connection request"))
    pendingRequestResolvers.delete(requestId)
    browser.storage.local.remove(`pendingRequest_${requestId}`)
  }
  res.send({ success: true })
}

export default handler
