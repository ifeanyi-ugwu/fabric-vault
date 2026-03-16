import type { PlasmoMessaging } from "@plasmohq/messaging"

import { emitEventToDapp } from "~services/connection"

export type RequestBody = { event: string; data?: unknown }
export type ResponseBody = { success: boolean }

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  const { event, data } = req.body!
  await emitEventToDapp({
    type: event,
    result: data ?? null
  })
  res.send({ success: true })
}

export default handler
