import { useCallback, useEffect, useState } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import browser from "webextension-polyfill"

import type { RequestBody as EmitEventBody } from "~background/messages/emit-event"
import type { Identity } from "~/contexts/identity"

export interface SiteIdentityConnection {
  identityLabel: string
  timestamp: number
}

export function useIdentityToSiteConnection() {
  const [connectedSites, setConnectedSites] = useState<
    Map<string, SiteIdentityConnection[]>
  >(new Map())
  const [currentHostname, setCurrentHostname] = useState("")

  useEffect(() => {
    const getCurrentTabHostname = async () => {
      try {
        const tabs = await browser.tabs.query({
          active: true,
          currentWindow: true
        })
        if (tabs && tabs.length > 0 && tabs[0].url) {
          const url = new URL(tabs[0].url)
          setCurrentHostname(
            url.protocol +
              "//" +
              url.hostname +
              (url.port ? `:${url.port}` : "")
          )
        } else {
          setCurrentHostname("")
        }
      } catch (error) {
        setCurrentHostname("")
      }
    }

    const loadConnectionsFromStorage = async () => {
      const storedConnections = (await browser.storage.local.get("fabricVaultConnections"))["fabricVaultConnections"] as string | undefined
      if (storedConnections) {
        try {
          const parsedConnections = JSON.parse(storedConnections) as Record<
            string,
            SiteIdentityConnection[]
          >
          setConnectedSites(new Map(Object.entries(parsedConnections)))
        } catch (e) {
          console.error("Failed to parse stored connections", e)
        }
      }
    }

    getCurrentTabHostname()
    loadConnectionsFromStorage()
  }, [])

  console.log({ connectedSites })

  const isIdentityConnectedToSite = useCallback(
    (identity: Identity) => {
      if (!identity || !currentHostname) return false

      const siteConnections = connectedSites.get(currentHostname)
      if (!siteConnections) return false

      return siteConnections.some(
        (conn) => conn.identityLabel === identity.label
      )
    },
    [currentHostname, connectedSites]
  )

  // Toggle connection for current identity and site
  const toggleConnection = useCallback(
    async (identity: Identity) => {
      if (!identity || !currentHostname) return

      const newConnectedSites = new Map(connectedSites)
      const siteConnections = newConnectedSites.get(currentHostname) || []

      const isConnected = siteConnections.some(
        (conn) => conn.identityLabel === identity.label
      )

      let eventData: Identity[]

      if (isConnected) {
        const filteredConnections = siteConnections.filter(
          (conn) => conn.identityLabel !== identity.label
        )
        if (filteredConnections.length > 0) {
          newConnectedSites.set(currentHostname, filteredConnections)
        } else {
          newConnectedSites.delete(currentHostname)
        }
        eventData = []
      } else {
        const newConnection = {
          identityLabel: identity.label,
          timestamp: Date.now()
        }
        newConnectedSites.set(currentHostname, [
          ...siteConnections,
          newConnection
        ])
        eventData = [identity]
      }

      setConnectedSites(newConnectedSites)

      const connectionsObject = Object.fromEntries(newConnectedSites)
      await browser.storage.local.set({ fabricVaultConnections: JSON.stringify(connectionsObject) })

      sendToBackground<EmitEventBody>({
        name: "emit-event",
        body: { event: "identitiesChanged", data: eventData }
      })
    },
    [currentHostname, connectedSites]
  )

  // Check if site has any connected identities
  const hasSiteConnections = useCallback(() => {
    if (!currentHostname) return false
    const siteConnections = connectedSites.get(currentHostname)
    return siteConnections && siteConnections.length > 0
  }, [currentHostname, connectedSites])

  return {
    currentHostname,
    isIdentityConnectedToSite,
    toggleConnection
  }
}
