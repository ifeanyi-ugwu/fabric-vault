import browser from "webextension-polyfill"

import type { PlasmoMessaging } from "@plasmohq/messaging"

import { pendingRequestResolvers } from "~background/state"
import type { RequestData } from "~contexts/request"
import { applyPeerRequest, parsePeerRequest } from "~lib/peer-request"
import type { StoredPeer } from "~lib/peer-request"
import { sessionStore } from "~lib/storage"
import { emitEventToDapp } from "~services/connection"

export type RequestBody = { requestId: string }
export type ResponseBody = { success: boolean; error?: string }

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  const { requestId } = req.body!
  // The peer comes from the stored request, which was validated when it
  // arrived, and not from the popup's message.
  const pending = await sessionStore.get<RequestData>(
    `pendingRequest_${requestId}`
  )
  const resolver = pendingRequestResolvers.get(requestId)
  if (!pending || pending.type !== "peer" || !resolver) {
    res.send({ success: false, error: "No such peer request." })
    return
  }

  try {
    const request = parsePeerRequest(pending.payload.params)
    const stored = (await browser.storage.local.get("availablePeers"))[
      "availablePeers"
    ] as StoredPeer[] | undefined
    const { peers, selected, added } = applyPeerRequest(
      stored ?? [],
      request,
      crypto.randomUUID()
    )
    await browser.storage.local.set({
      ...(added ? { availablePeers: peers } : {}),
      selectedPeer: selected
    })
    resolver.resolve({ name: selected.name, endpoint: selected.endpoint })
    await emitEventToDapp({ type: "peerChanged", result: selected.endpoint })
    res.send({ success: true })
  } catch (error) {
    resolver.reject(error)
    res.send({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  } finally {
    pendingRequestResolvers.delete(requestId)
    await sessionStore.remove(`pendingRequest_${requestId}`)
  }
}

export default handler
