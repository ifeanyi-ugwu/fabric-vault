import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react"

/**
 * Peers are external organizations/nodes that this vault/wallet can connect to
 *
 * eg: org1.example.com, org2.example.com
 */
export interface Peer {
  id: string
  name: string
  endpoint: string
  rpcUrl: string
  tlsRootCert: string | null
}

interface PeerContextType {
  selectedPeer: Peer | null
  switchPeer: (peer: Peer) => void
  peers: Peer[]
  addPeer: (newPeer: Omit<Peer, "id">) => void
  updatePeer: (updatedPeer: Peer) => void
  removePeer: (peerToRemove: Peer) => void
}

const PeerContext = createContext<PeerContextType | undefined>(undefined)

const availablePeersStorageKey = "availablePeers"
const selectedPeerStorageKey = "selectedPeer"

const savePeersToStorage = (peers: Peer[]) => {
  chrome.storage.local.set({ [availablePeersStorageKey]: peers })
}

export function PeerProvider({ children }: { children: ReactNode }) {
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null)
  const [peers, setPeers] = useState<Peer[]>([])

  useEffect(() => {
    // Load available peers from Chrome Storage on component mount
    chrome.storage.local.get([availablePeersStorageKey], (result) => {
      const storedPeers = result[availablePeersStorageKey] as Peer[] | undefined
      setPeers(storedPeers || [])
    })
  }, [])

  useEffect(() => {
    // Load selected peer from Chrome Storage on component mount
    chrome.storage.local.get([selectedPeerStorageKey], (result) => {
      const storedPeerId = result[selectedPeerStorageKey]?.id
      if (storedPeerId && peers.length > 0) {
        const initialSelected = peers.find((peer) => peer.id === storedPeerId)
        setSelectedPeer(initialSelected || null)
      }
    })
  }, [peers])

  useEffect(() => {
    // Save selected peer to Chrome Storage whenever it changes
    if (selectedPeer) {
      chrome.storage.local.set({ [selectedPeerStorageKey]: selectedPeer })
    }
  }, [selectedPeer])

  const addPeer = useCallback((newPeer: Omit<Peer, "id">) => {
    const peerToAdd: Peer = {
      ...newPeer,
      id: crypto.randomUUID()
    }
    setPeers((prevPeers) => {
      const updatedPeers = [...prevPeers, peerToAdd]
      savePeersToStorage(updatedPeers)
      return updatedPeers
    })
  }, [])

  const updatePeer = useCallback(
    (updatedPeer: Peer) => {
      setPeers((prevPeers) => {
        const updatedPeers = prevPeers.map((peer) =>
          peer.id === updatedPeer.id ? updatedPeer : peer
        )
        savePeersToStorage(updatedPeers)
        return updatedPeers
      })
      // If the updated peer was the selected one, update the selected state too
      if (selectedPeer?.id === updatedPeer.id) {
        setSelectedPeer(updatedPeer)
      }
    },
    [selectedPeer]
  )

  const removePeer = useCallback(
    (peerToRemove: Peer) => {
      setPeers((prevPeers) => {
        const updatedPeers = prevPeers.filter(
          (peer) => peer.id !== peerToRemove.id
        )
        savePeersToStorage(updatedPeers)
        return updatedPeers
      })
      // If the removed peer was the selected one, clear the selected state
      if (selectedPeer?.id === peerToRemove.id) {
        setSelectedPeer(null)
      }
    },
    [selectedPeer]
  )

  const switchPeer = (peer: Peer) => {
    setSelectedPeer(peer)
    chrome.runtime.sendMessage({
      type: "EVENT_REQUEST",
      payload: {
        event: "peerChanged",
        data: peer.endpoint
      }
    })
  }

  return (
    <PeerContext.Provider
      value={{
        selectedPeer,
        switchPeer,
        peers,
        addPeer,
        updatePeer,
        removePeer
      }}>
      {children}
    </PeerContext.Provider>
  )
}

export function usePeer() {
  const context = useContext(PeerContext)
  if (!context) {
    throw new Error("usePeer must be used within a PeerProvider")
  }
  return context
}
