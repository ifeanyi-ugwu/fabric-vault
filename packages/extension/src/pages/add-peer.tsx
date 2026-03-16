import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"

import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { DropZone } from "~/components/ui/drop-zone"
import { usePeer } from "~/contexts/peer"

export function AddPeer() {
  const navigate = useNavigate()
  const { addPeer } = usePeer()
  const [peerName, setPeerName] = useState("")
  const [peerEndpoint, setPeerEndpoint] = useState("")
  const [rpcUrl, setRpcUrl] = useState("")
  const [tlsRootCert, setTlsRootCert] = useState<string | null>(null)
  const [tlsFileName, setTlsFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTlsFile = (file: File) => {
    setTlsFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      setTlsRootCert(e.target?.result as string)
    }
    reader.readAsText(file)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

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

    addPeer({ name: peerName, endpoint: peerEndpoint, rpcUrl, tlsRootCert })
    window.history.length > 1 ? navigate({ to: "/dashboard" }) : window.close()
  }

  const handleCancel = () => {
    window.history.length > 1 ? navigate({ to: "/dashboard" }) : window.close()
  }

  return (
    <div className="view">
      <Card title="Add Peer" subtitle="Add a new peer to your wallet">
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
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button type="submit">Add Peer</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
