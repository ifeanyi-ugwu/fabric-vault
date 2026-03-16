import type { PlasmoMessaging } from "@plasmohq/messaging"

import { handleChangePassword } from "~services/vault"

export type RequestBody = { newPassword: string }
export type ResponseBody = { success: boolean; error?: string }

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  const result = await handleChangePassword(req.body!.newPassword)
  res.send(result)
}

export default handler
