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
          onClick={(e) => {
            e.stopPropagation()
            onDelete(identity)
          }}>
          <span className="delete-icon" />
        </button>
      </div>
    </div>
  )
}
