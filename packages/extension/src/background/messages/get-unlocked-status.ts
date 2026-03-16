import type { PlasmoMessaging } from "@plasmohq/messaging"

import { getUnlockedStatus } from "~services/vault"

export type ResponseBody = { isUnlocked: boolean }

const handler: PlasmoMessaging.MessageHandler<
  never,
  ResponseBody
> = async (_req, res) => {
  const result = await getUnlockedStatus()
  res.send(result)
}

export default handler
