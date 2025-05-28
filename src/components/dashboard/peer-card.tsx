import { useState } from "react"

import { Button } from "~/components/ui/button"
import type { Peer } from "~/contexts/peer"

import "./peer-card.css"

interface PeerCardProps {
  peer: Peer
  isActive: boolean
  onClick: (peer: Peer) => void
  onDelete: (peer: Peer) => void
}

export const PeerCard = ({
  peer,
  isActive,
  onClick,
  onDelete
}: PeerCardProps) => {
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false)

  const handleCardClick = () => {
    onClick(peer)
  }

  const handleDeleteClick = () => {
    setIsDeleteConfirmationOpen(true)
  }

  const confirmDelete = () => {
    onDelete(peer)
    setIsDeleteConfirmationOpen(false)
  }

  const cancelDelete = () => {
    setIsDeleteConfirmationOpen(false)
  }

  return (
    <div
      className={`peer-card ${isActive ? "peer-card-active" : ""}`}
      onClick={handleCardClick}>
      <div className="peer-info">
        <h4 className="peer-name">{peer.name}</h4>
        <p className="peer-endpoint">Endpoint: {peer.endpoint}</p>
        {<p className="peer-rpc-url">RPC URL: {peer.rpcUrl}</p>}
        {peer.tlsRootCert && <p className="peer-cert">Has Cert</p>}
      </div>
      <div className="peer-actions">
        <Button
          className="delete-button"
          size="small"
          onClick={handleDeleteClick}>
          Delete
        </Button>
      </div>

      {isDeleteConfirmationOpen && (
        <div className="confirmation-overlay">
          <div className="confirmation-dialog">
            <p>Are you sure you want to delete peer "{peer.name}"?</p>
            <div className="confirmation-buttons">
              <Button onClick={confirmDelete} size="small">
                Confirm
              </Button>
              <Button
                onClick={cancelDelete}
                variant="outline"
                size="small"
                fullWidth>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
