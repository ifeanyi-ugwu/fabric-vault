import { useState } from "react"
import browser from "webextension-polyfill"

import { Button } from "~/components/ui/button"
import { DropZone } from "~/components/ui/drop-zone"
import { Modal } from "~/components/ui/modal"
import { usePeer, type Peer } from "~/contexts/peer"

import { Empty } from "../empty"
import { PeerCard } from "../peer-card"

export function Peers() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [peerToEdit, setPeerToEdit] = useState<Peer | null>(null)
  const {
    peers,
    selectedPeer: activePeer,
    switchPeer,
    removePeer,
    addPeer,
    updatePeer
  } = usePeer()

  const handleAddPeer = ({ id: _id, ...rest }: Peer) => {
    addPeer(rest)
    setIsAddModalOpen(false)
  }

  const handleEditPeer = (updatedPeer: Peer) => {
    updatePeer(updatedPeer)
    setPeerToEdit(null)
  }

  const handleAddModalOpenChange = (open: boolean) => {
    setIsAddModalOpen(open)
  }

  // Firefox closes extension popups when a file picker dialog opens, so we
  // open the page in a separate browser window instead where that doesn't apply.
  const openAddPeer = () => {
    if (navigator.userAgent.includes("Firefox")) {
      browser.windows.create({
        url: browser.runtime.getURL("popup.html#/add-peer"),
        type: "popup",
        width: 360,
        height: 600
      })
    } else {
      setIsAddModalOpen(true)
    }
  }

  return (
    <div>
      <div className="section-header">
        <h3>Your Peers</h3>
        <Button variant="secondary" size="small" onClick={openAddPeer}>
          Add Peer
        </Button>
        <Modal isOpen={isAddModalOpen} onOpenChange={handleAddModalOpenChange}>
          <Modal.Content>
            <Modal.Header>Add New Peer</Modal.Header>
            <Modal.Body>
              <PeerForm onSubmit={handleAddPeer} onCancel={() => setIsAddModalOpen(false)} />
            </Modal.Body>
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
              onEdit={(p) => setPeerToEdit(p)}
              onDelete={() => removePeer(peer)}
            />
          ))}
        </div>
      ) : (
        <Empty
          title="No Peers"
          description="Add a peer to start interacting with them"
          actionLabel="Add Peer"
          onAction={openAddPeer}
        />
      )}

      <Modal isOpen={peerToEdit !== null} onOpenChange={(open) => { if (!open) setPeerToEdit(null) }}>
        <Modal.Content>
          <Modal.Header>Edit Peer</Modal.Header>
          <Modal.Body>
            {peerToEdit && (
              <PeerForm
                initialPeer={peerToEdit}
                onSubmit={handleEditPeer}
                onCancel={() => setPeerToEdit(null)}
              />
            )}
          </Modal.Body>
        </Modal.Content>
      </Modal>
    </div>
  )
}

interface PeerFormProps {
  initialPeer?: Peer
  onSubmit: (peerData: Peer) => void
  onCancel: () => void
}

const PeerForm = ({ initialPeer, onSubmit, onCancel }: PeerFormProps) => {
  const [peerName, setPeerName] = useState(initialPeer?.name ?? "")
  const [peerEndpoint, setPeerEndpoint] = useState(initialPeer?.endpoint ?? "")
  const [rpcUrl, setRpcUrl] = useState(initialPeer?.rpcUrl ?? "")
  const [tlsRootCert, setTlsRootCert] = useState<string | null>(initialPeer?.tlsRootCert ?? null)
  const [tlsFileName, setTlsFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isEditing = initialPeer !== undefined

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

    onSubmit({
      id: initialPeer?.id ?? crypto.randomUUID(),
      name: peerName,
      endpoint: peerEndpoint,
      rpcUrl,
      tlsRootCert
    })
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

      <div className="form-actions">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{isEditing ? "Save Changes" : "Add Peer"}</Button>
      </div>
    </form>
  )
}
