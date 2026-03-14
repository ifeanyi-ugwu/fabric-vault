import { useState } from "react"

import { Button } from "~/components/ui/button"
import { DropZone } from "~/components/ui/drop-zone"
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
    <div>
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
  const [tlsFileName, setTlsFileName] = useState<string | null>(null)
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
    setTlsFileName(null)
    setError(null)
  }

  const handleTlsFile = (file: File) => {
    setTlsFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      setTlsRootCert(e.target?.result as string)
    }
    reader.readAsText(file)
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="error-message">{error}</p>}
      <div className="form-group">
        <label htmlFor="peerName">Peer Name</label>
        <input
          type="text"
          id="peerName"
          value={peerName}
          onChange={(e) => setPeerName(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="peerEndpoint">Peer Endpoint</label>
        <input
          type="text"
          id="peerEndpoint"
          value={peerEndpoint}
          onChange={(e) => setPeerEndpoint(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="rpcUrl">RPC URL</label>
        <input
          type="text"
          id="rpcUrl"
          value={rpcUrl}
          onChange={(e) => setRpcUrl(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label>TLS Root Certificate (Optional)</label>
        <DropZone
          accept=".crt,.pem"
          fileName={tlsFileName}
          onChange={handleTlsFile}
          placeholder="Drop .crt or .pem here, or click to browse"
        />
      </div>

      <Button type="submit" fullWidth>
        Add Peer
      </Button>
    </form>
  )
}
