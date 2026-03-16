import { useNavigate } from "@tanstack/react-router"
import browser from "webextension-polyfill"

import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { useThemeContext } from "~/contexts/theme"

export const Settings = () => {
  const navigate = useNavigate()
  const { theme, toggle } = useThemeContext()

  return (
    <div>
      <Card title="Security">
        <div className="settings-item">
          <div className="settings-label">Password</div>
          <Button
            variant="outline"
            size="small"
            onClick={() => navigate({ to: "/change-password" })}>
            Change
          </Button>
        </div>
      </Card>

      <Card title="Appearance">
        <div className="settings-item">
          <div className="settings-label">Theme</div>
          <button
            className="theme-toggle"
            onClick={toggle}
            aria-label="Toggle theme">
            <span className={`theme-icon ${theme}`} />
            {theme === "dark" ? "Dark" : "Light"}
          </button>
        </div>
      </Card>

      <Card title="About">
        <div className="app-info">
          <div className="app-version">
            FabricVault v{browser.runtime.getManifest().version}
          </div>
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
