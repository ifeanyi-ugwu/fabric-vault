import { useNavigate } from "@tanstack/react-router"

import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"

export const Settings = () => {
  const navigate = useNavigate()

  return (
    <div className="tab-content">
      <Card title="Security">
        <div className="settings-item">
          <div className="settings-label">Password</div>
          <Button
            variant="outline"
            size="small"
            onClick={() => navigate({ to: "/change-password" })}>
            Change Password
          </Button>
        </div>
      </Card>

      <Card title="About" className="mt-4">
        <div className="app-info">
          <div className="app-version">FabricVault v0.1.0</div>
          <p className="app-description">
            A secure browser extension wallet for Hyperledger Fabric
          </p>
        </div>
      </Card>

      <div className="form-actions mt-4">
        <Button
          variant="secondary"
          onClick={() => navigate({ to: "/unlock-wallet" })}
          fullWidth>
          Lock Wallet
        </Button>
      </div>
    </div>
  )
}
