import type { PlasmoMessaging } from "@plasmohq/messaging"

import { handleCreateVault } from "~services/vault"

export type RequestBody = { password: string }
export type ResponseBody = { success: boolean; error?: string }

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  const result = await handleCreateVault(req.body!.password)
  res.send(result)
}

export default handler
