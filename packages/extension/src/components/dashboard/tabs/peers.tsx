import { useState } from "react"

import { Button } from "~/components/ui/button"
import { Modal } from "~/components/ui/modal"
import { usePeer, type Peer } from "~/contexts/peer"

import { Empty } from "../empty"
import { PeerCard } from "../peer-card"

export function Peers() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const {
    peers,
    selectedPeer: activePeer,
    switchPeer,
    removePeer,
    addPeer
  } = usePeer()

  const handleAddPeer = (newPeerData: Peer) => {
    addPeer(newPeerData)
    setIsAddModalOpen(false)
  }

  const handleAddModalOpenChange = (open: boolean) => {
    setIsAddModalOpen(open)
  }

  return (
    <div className="tab-content">
      <div className="section-header">
        <h3>Your Peers</h3>
        <Modal isOpen={isAddModalOpen} onOpenChange={handleAddModalOpenChange}>
          <Modal.Trigger asChild>
            <Button variant="secondary" size="small">
              Add Peer
            </Button>
          </Modal.Trigger>
          <Modal.Content>
            <Modal.Header>Add New Peer</Modal.Header>
            <Modal.Body>
              <AddPeerForm onSubmit={handleAddPeer} />
            </Modal.Body>
            <Modal.Footer>
              <Modal.CloseButton>Cancel</Modal.CloseButton>
            </Modal.Footer>
          </Modal.Content>
        </Modal>
      </div>

      {peers.length > 0 ? (
        <div className="peers-list">
          {peers.map((peer) => (
            <PeerCard
              key={peer.id}
              peer={peer}
              isActive={activePeer?.id === peer.id}
              onClick={() => switchPeer(peer)}
              onDelete={() => removePeer(peer)}
            />
          ))}
        </div>
      ) : (
        <Empty
          title="No Peers"
          description="Add a peer to start interacting with them"
          actionLabel="Add Peer"
          onAction={() => setIsAddModalOpen(true)}
        />
      )}
    </div>
  )
}

interface AddPeerFormProps {
  onSubmit: (newPeerData: Partial<Peer>) => void
}

const AddPeerForm = ({ onSubmit }: AddPeerFormProps) => {
  const [peerName, setPeerName] = useState("")
  const [peerEndpoint, setPeerEndpoint] = useState("")
  const [rpcUrl, setRpcUrl] = useState("")
  const [tlsRootCert, setTlsRootCert] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!peerName.trim()) {
      setError("Peer name cannot be empty.")
      return
    }
    if (!peerEndpoint.trim()) {
      setError("Peer endpoint cannot be empty.")
      return
    }
    if (!rpcUrl.trim()) {
      setError("RPC URL cannot be empty.")
      return
    }

    onSubmit({ name: peerName, endpoint: peerEndpoint, rpcUrl, tlsRootCert })
    setPeerName("")
    setPeerEndpoint("")
    setRpcUrl("")
    setTlsRootCert(null)
    setError(null)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setTlsRootCert(e.target?.result as string)
      }
      reader.readAsText(file)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p className="error-message">{error}</p>}
      <div>
        <label htmlFor="peerName">Peer Name:</label>
        <input
          type="text"
          id="peerName"
          value={peerName}
          onChange={(e) => setPeerName(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="peerEndpoint">Peer Endpoint:</label>
        <input
          type="text"
          id="peerEndpoint"
          value={peerEndpoint}
          onChange={(e) => setPeerEndpoint(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="rpcUrl">RPC URL:</label>
        <input
          type="text"
          id="rpcUrl"
          value={rpcUrl}
          onChange={(e) => setRpcUrl(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="tlsRootCert">TLS Root Certificate (Optional):</label>
        <input
          type="file"
          id="tlsRootCert"
          accept=".crt,.pem"
          onChange={handleFileChange}
        />
        {tlsRootCert && (
          <div className="mt-2 text-sm text-gray-500">
            Selected File: {tlsRootCert.substring(0, 50)}...
          </div>
        )}
      </div>

      <Button type="submit" className="mt-4">
        Add Peer
      </Button>
    </form>
  )
}
