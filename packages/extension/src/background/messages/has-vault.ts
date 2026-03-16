import type { PlasmoMessaging } from "@plasmohq/messaging"

import { hasVault } from "~services/vault"

export type ResponseBody = { hasVault: boolean }

const handler: PlasmoMessaging.MessageHandler<
  never,
  ResponseBody
> = async (_req, res) => {
  res.send({ hasVault: await hasVault() })
}

export default handler
