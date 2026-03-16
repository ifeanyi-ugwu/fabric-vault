import type { PlasmoMessaging } from "@plasmohq/messaging"

import { ensureWalletReady } from "~services/session"
import { removeIdentity } from "~services/wallet"

export type RequestBody = { label: string }
export type ResponseBody = { success: boolean; error?: string }

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  if (!(await ensureWalletReady())) {
    res.send({ success: false, error: "Wallet is locked." })
    return
  }

  const { label } = req.body!
  try {
    await removeIdentity(label)
    res.send({ success: true })
  } catch (error) {
    res.send({ success: false, error: error.message })
  }
}

export default handler
