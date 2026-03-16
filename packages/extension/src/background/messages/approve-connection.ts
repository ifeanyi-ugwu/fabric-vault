import type { PlasmoMessaging } from "@plasmohq/messaging"
import browser from "webextension-polyfill"

import type { Identity } from "~contexts/identity"
import type { Peer } from "~contexts/peer"
import type { SiteIdentityConnection } from "~hooks/use-identity-to-site-connection"
import { pendingRequestResolvers } from "~background/state"
import { emitEventToDapp, getStoredConnections } from "~services/connection"

export type RequestBody = {
  requestId: string
  origin: string
  identities: Identity[]
}
export type ResponseBody = { success: boolean }

async function storeConnection(origin: string, labels: string[]) {
  const storedConnections = await getStoredConnections()
  const existingConnectionsForSite = storedConnections.get(origin) || []
  const newConnections: SiteIdentityConnection[] = labels
    .map((label) => ({ identityLabel: label, timestamp: Date.now() }))
    .filter(
      (newConnection) =>
        !existingConnectionsForSite.some(
          (existing) => existing.identityLabel === newConnection.identityLabel
        )
    )

  storedConnections.set(origin, [...existingConnectionsForSite, ...newConnections])

  const connectionsObject = Object.fromEntries(storedConnections)
  await browser.storage.local.set({
    fabricVaultConnections: JSON.stringify(connectionsObject)
  })
}

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  const { requestId, origin, identities } = req.body!
  const resolver = pendingRequestResolvers.get(requestId)

  if (resolver) {
    resolver.resolve(
      identities.map((id) => ({
        label: id.label,
        mspId: id.mspId,
        certificate: id.certificate
      }))
    )
    pendingRequestResolvers.delete(requestId)
    browser.storage.local.remove(`pendingRequest_${requestId}`)

    if (origin && Array.isArray(identities)) {
      await storeConnection(
        origin,
        identities.map((identity) => identity.label)
      )
    }

    const peer = (await browser.storage.local.get("selectedPeer"))[
      "selectedPeer"
    ] as Peer | undefined
    await emitEventToDapp({
      type: "connect",
      result: { peerEndpoint: peer?.endpoint }
    })
  }

  res.send({ success: true })
}

export default handler
