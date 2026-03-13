import type { Identity } from "~/contexts/identity"

interface IdentityCardProps {
  identity: Identity
  isActive: boolean
  //onSelect: (id: string) => void
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
        <div className="id-org">MSP ID: {identity.mspId}</div>
      </div>
      <div className="id-actions">
        <button className="icon-button" title="Copy ID">
          <span className="copy-icon" />
        </button>
        <button className="icon-button" title="Export Certificate">
          <span className="export-icon" />
        </button>
        <button
          className="icon-button"
          title="Delete Identity"
          onClick={() => onDelete(identity)}>
          <span className="delete-icon" />
        </button>
      </div>
    </div>
  )
}
