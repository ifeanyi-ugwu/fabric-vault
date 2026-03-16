import { useNavigate } from "@tanstack/react-router"
import browser from "webextension-polyfill"

import { Button } from "~/components/ui/button"
import { useIdentity } from "~/contexts/identity"

import { Empty } from "../empty"
import { IdentityCard } from "../identity-card"

export const Identities = () => {
  const navigate = useNavigate()
  const { identities, selectedIdentity, switchIdentity, removeIdentity } =
    useIdentity()

  const openAddIdentity = () => {
    // Firefox closes extension popups when a file picker dialog opens, so we
    // open the page in a separate browser window instead where that doesn't apply.
    if (navigator.userAgent.includes("Firefox")) {
      browser.windows.create({
        url: browser.runtime.getURL("popup.html#/add-identity"),
        type: "popup",
        width: 360,
        height: 600
      })
    } else {
      navigate({ to: "/add-identity" })
    }
  }

  return (
    <div>
      <div className="section-header">
        <h3>Your Identities</h3>
        <Button
          variant="secondary"
          size="small"
          onClick={openAddIdentity}>
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
          onAction={openAddIdentity}
        />
      )}
    </div>
  )
}
