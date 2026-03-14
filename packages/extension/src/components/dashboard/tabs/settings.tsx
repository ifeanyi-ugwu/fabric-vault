import { useNavigate } from "@tanstack/react-router"

import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"

export const Settings = () => {
  const navigate = useNavigate()

  return (
    <div>
      <Card title="Security">
        <div className="settings-item">
          <div>
            <div className="settings-label">Password</div>
          </div>
          <Button
            variant="outline"
            size="small"
            onClick={() => navigate({ to: "/change-password" })}>
            Change
          </Button>
        </div>
      </Card>

      <Card title="About">
        <div className="app-info">
          <div className="app-version">FabricVault v0.0.3</div>
          <p className="app-description">
            Secure browser wallet for Hyperledger Fabric
          </p>
        </div>
      </Card>

      <Button
        variant="danger"
        fullWidth
        onClick={() => navigate({ to: "/unlock-wallet" })}>
        Lock Wallet
      </Button>
    </div>
  )
}
