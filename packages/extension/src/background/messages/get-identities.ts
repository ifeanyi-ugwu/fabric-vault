import type { PlasmoMessaging } from "@plasmohq/messaging"

import { ensureWalletReady } from "~services/session"
import { getIdentities } from "~services/wallet"

export type ResponseBody =
  | { success: true; identities: unknown[] }
  | { success: false; error: string }

const handler: PlasmoMessaging.MessageHandler<
  never,
  ResponseBody
> = async (_req, res) => {
  if (!(await ensureWalletReady())) {
    res.send({ success: false, error: "Wallet is locked." })
    return
  }

  try {
    res.send({ success: true, identities: await getIdentities() })
  } catch (error) {
    res.send({ success: false, error: error.message })
  }
}

export default handler
