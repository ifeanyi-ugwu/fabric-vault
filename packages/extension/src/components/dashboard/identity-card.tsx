import { useState } from "react"

import { Button } from "~/components/ui/button"
import type { Identity } from "~/contexts/identity"

interface IdentityCardProps {
  identity: Identity
  isActive: boolean
  onClick: () => void
  onDelete: (identity: Identity) => void
}

export const IdentityCard = ({
  identity,
  isActive,
  onClick,
  onDelete
}: IdentityCardProps) => {
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDeleteConfirmationOpen(true)
  }

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(identity)
    setIsDeleteConfirmationOpen(false)
  }

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDeleteConfirmationOpen(false)
  }

  return (
    <div className={`id-card ${isActive ? "active" : ""}`} onClick={onClick}>
      <div className="id-card-header">
        <h4 className="id-name">{identity.label}</h4>
        {isActive && <span className="active-badge">Active</span>}
      </div>
      <div className="id-details">
        <span className="id-org">{identity.mspId}</span>
      </div>
      <div className="id-actions">
        <button
          className="icon-button"
          title="Copy label"
          onClick={(e) => {
            e.stopPropagation()
            navigator.clipboard.writeText(identity.label)
          }}>
          <span className="copy-icon" />
        </button>
        <button className="icon-button" title="Export certificate" onClick={(e) => e.stopPropagation()}>
          <span className="export-icon" />
        </button>
        <button
          className="icon-button"
          title="Delete identity"
          onClick={handleDeleteClick}>
          <span className="delete-icon" />
        </button>
      </div>

      {isDeleteConfirmationOpen && (
        <div className="confirmation-overlay" onClick={cancelDelete}>
          <div className="confirmation-dialog" onClick={(e) => e.stopPropagation()}>
            <p>Are you sure you want to delete identity "{identity.label}"?</p>
            <div className="confirmation-buttons">
              <Button onClick={confirmDelete} size="small">
                Confirm
              </Button>
              <Button onClick={cancelDelete} variant="outline" size="small" fullWidth>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
