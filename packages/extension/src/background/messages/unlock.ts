import type { PlasmoMessaging } from "@plasmohq/messaging"

import { handleUnlock } from "~services/vault"

export type RequestBody = { password: string }
export type ResponseBody = { success: boolean; error?: string }

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  const result = await handleUnlock(req.body!.password)
  res.send(result)
}

export default handler
