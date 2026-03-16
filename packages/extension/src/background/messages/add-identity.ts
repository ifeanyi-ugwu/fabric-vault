import type { PlasmoMessaging } from "@plasmohq/messaging"

import { ensureWalletReady } from "~services/session"
import { addIdentity } from "~services/wallet"

export type RequestBody = {
  identity: {
    label: string
    mspId: string
    certificate: string
    privateKey: string
  }
}
export type ResponseBody = { success: boolean; error?: string }

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  if (!(await ensureWalletReady())) {
    res.send({ success: false, error: "Wallet is locked." })
    return
  }

  const { identity } = req.body!
  try {
    await addIdentity(identity)
    res.send({ success: true })
  } catch (error) {
    res.send({ success: false, error: error.message })
  }
}

export default handler
