import { useNavigate } from "@tanstack/react-router"

import { Button } from "~/components/ui/button"
import { useIdentity } from "~/contexts/identity"

import { Empty } from "../empty"
import { IdentityCard } from "../identity-card"

export const Identities = () => {
  const navigate = useNavigate()
  const { identities, selectedIdentity, switchIdentity, removeIdentity } =
    useIdentity()

  return (
    <div className="tab-content">
      <div className="section-header">
        <h3>Your Identities</h3>
        <Button
          variant="secondary"
          size="small"
          onClick={() => navigate({ to: "/add-identity" })}>
          Add Identity
        </Button>
      </div>

      {identities.length > 0 ? (
        <div className="identities-list">
          {identities.map((identity) => (
            <IdentityCard
              key={identity.label}
              identity={identity}
              isActive={selectedIdentity?.label === identity.label}
              onClick={() => switchIdentity(identity)}
              onDelete={() => removeIdentity(identity)}
            />
          ))}
        </div>
      ) : (
        <Empty
          title="No Identities"
          description="Add an identity to start interacting with Hyperledger Fabric networks"
          actionLabel="Add Identity"
          onAction={() => navigate({ to: "/add-identity" })}
        />
      )}
    </div>
  )
}
