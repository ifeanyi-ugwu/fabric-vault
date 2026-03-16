import type { PlasmoMessaging } from "@plasmohq/messaging"

import { handleLock } from "~services/vault"

export type ResponseBody = { success: boolean }

const handler: PlasmoMessaging.MessageHandler<
  never,
  ResponseBody
> = async (_req, res) => {
  const result = await handleLock()
  res.send(result)
}

export default handler
