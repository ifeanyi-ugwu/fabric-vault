import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react"

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

  // Fetch saved connections from local storage
  /*useEffect(() => {
    chrome.storage.local.get(null, (data) => {
      const savedSites = Object.keys(data).map((origin) => ({
        origin,
        connected: data[origin]
      }))
      setConnectedSites(savedSites)
    })
  }, [])

  // Check if the current site is connected
  useEffect(() => {
    const currentOrigin = window.location.origin
    const site = connectedSites.find((site) => site.origin === currentOrigin)
    if (site) {
      setIsCurrentSiteConnected(site.connected)
    } else {
      setIsCurrentSiteConnected(false) // Not connected yet
    }
  }, [connectedSites])

  const connectSite = () => {
    const currentOrigin = window.location.origin
    const updatedSites = [
      ...connectedSites,
      { origin: currentOrigin, connected: true }
    ]
    setConnectedSites(updatedSites)
    chrome.storage.local.set({
      ...chrome.storage.local.get(),
      [currentOrigin]: true
    })
    setIsCurrentSiteConnected(true)
  }

  const disconnectSite = () => {
    const currentOrigin = window.location.origin
    const updatedSites = connectedSites.filter(
      (site) => site.origin !== currentOrigin
    )
    setConnectedSites(updatedSites)
    chrome.storage.local.remove(currentOrigin)
    setIsCurrentSiteConnected(false)
  }*/
  const currentOrigin = window.location.origin

  // Sync connected sites from chrome storage
  /*const loadConnections = () => {
    chrome.storage.local.get(null, (data) => {
      const sites = Object.entries(data).map(([origin, connected]) => ({
        origin,
        connected: Boolean(connected)
      }))
      setConnectedSites(sites)

      const thisSite = sites.find((site) => site.origin === currentOrigin)
      setIsCurrentSiteConnected(thisSite?.connected ?? false)
    })
  }*/
  const loadConnections = useCallback(() => {
    chrome.storage.local.get(null, (data) => {
      const sites = Object.entries(data).map(([origin, connected]) => ({
        origin,
        connected: Boolean(connected)
      }))
      setConnectedSites(sites)

      const thisSite = sites.find((site) => site.origin === currentOrigin)
      setIsCurrentSiteConnected(thisSite?.connected ?? false)
    })
  }, [currentOrigin])

  useEffect(() => {
    loadConnections()
  }, [])

  const connectSite = () => {
    chrome.storage.local.set({ [currentOrigin]: true }, loadConnections)
  }

  const disconnectSite = () => {
    chrome.storage.local.remove(currentOrigin, loadConnections)
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
