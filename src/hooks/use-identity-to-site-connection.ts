import { useCallback, useEffect, useState } from "react"

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
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true
        })
        if (tabs && tabs.length > 0 && tabs[0].url) {
          const url = new URL(tabs[0].url)
          //setCurrentHostname(url.hostname + (url.port ? `:${url.port}` : ""))
          setCurrentHostname(
            url.protocol +
              "//" +
              url.hostname +
              (url.port ? `:${url.port}` : "")
          )
        } else {
          //console.warn("Could not determine the current tab URL.")
          setCurrentHostname("")
        }
      } catch (error) {
        //console.error("Error getting current tab:", error)
        setCurrentHostname("")
      }
    }

    const loadConnectionsFromStorage = async () => {
      const result = await chrome.storage.local.get("fabricVaultConnections")
      const storedConnections = result.fabricVaultConnections
      if (storedConnections) {
        try {
          const parsedConnections = JSON.parse(storedConnections) as Record<
            string,
            SiteIdentityConnection[]
          >
          setConnectedSites(new Map(Object.entries(parsedConnections)))
        } catch (e) {
          console.error(
            "Failed to parse stored connections from chrome.storage.local",
            e
          )
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

      if (isConnected) {
        const filteredConnections = siteConnections.filter(
          (conn) => conn.identityLabel !== identity.label
        )
        if (filteredConnections.length > 0) {
          newConnectedSites.set(currentHostname, filteredConnections)
        } else {
          newConnectedSites.delete(currentHostname)
        }

        chrome.runtime.sendMessage({
          type: "EVENT_REQUEST",
          payload: {
            event: "identitiesChanged",
            data: []
          }
        })
      } else {
        const newConnection = {
          identityLabel: identity.label,
          timestamp: Date.now()
        }
        newConnectedSites.set(currentHostname, [
          ...siteConnections,
          newConnection
        ])

        chrome.runtime.sendMessage({
          type: "EVENT_REQUEST",
          payload: {
            event: "identitiesChanged",
            data: [identity]
          }
        })
      }

      setConnectedSites(newConnectedSites)

      // Save to chrome.storage.local
      const connectionsObject = Object.fromEntries(newConnectedSites)
      await chrome.storage.local.set({
        fabricVaultConnections: JSON.stringify(connectionsObject)
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
