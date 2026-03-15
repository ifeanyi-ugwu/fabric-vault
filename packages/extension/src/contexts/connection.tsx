import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react"
import browser from "webextension-polyfill"

interface ConnectedSite {
  origin: string
  connected: boolean
}

interface ConnectionContextType {
  connectedSites: ConnectedSite[]
  isCurrentSiteConnected: boolean | null
  connectSite: () => void
  disconnectSite: () => void
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(
  undefined
)

export function ConnectionProvider({ children }) {
  const [connectedSites, setConnectedSites] = useState<ConnectedSite[]>([])
  const [isCurrentSiteConnected, setIsCurrentSiteConnected] = useState<
    boolean | null
  >(null)

  const currentOrigin = window.location.origin

  const loadConnections = useCallback(async () => {
    const data = await browser.storage.local.get(null)
    const sites = Object.entries(data).map(([origin, connected]) => ({
      origin,
      connected: Boolean(connected)
    }))
    setConnectedSites(sites)

    const thisSite = sites.find((site) => site.origin === currentOrigin)
    setIsCurrentSiteConnected(thisSite?.connected ?? false)
  }, [currentOrigin])

  useEffect(() => {
    loadConnections()
  }, [])

  const connectSite = async () => {
    await browser.storage.local.set({ [currentOrigin]: true })
    loadConnections()
  }

  const disconnectSite = async () => {
    await browser.storage.local.remove(currentOrigin)
    loadConnections()
  }

  return (
    <ConnectionContext.Provider
      value={{
        connectedSites,
        isCurrentSiteConnected,
        connectSite,
        disconnectSite
      }}>
      {children}
    </ConnectionContext.Provider>
  )
}

export const useConnection = (): ConnectionContextType => {
  const context = useContext(ConnectionContext)
  if (!context) {
    throw new Error("useConnection must be used within a ConnectionProvider")
  }
  return context
}
