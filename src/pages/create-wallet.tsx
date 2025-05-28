import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { useVault } from "~/contexts/vault"
import { useCreateWallet } from "~/hooks/use-create-wallet"

const CreateWallet = () => {
  const { handleSubmit, errorMessage } = useCreateWallet()
  const { hasVault } = useVault()
  const navigate = useNavigate()
  const [vaultExists, setVaultExists] = useState<boolean | null>(null)

  useEffect(() => {
    hasVault().then((exists) => {
      setVaultExists(exists)
    })
  }, [hasVault])

  return (
    <div className="view welcome-view">
      <div className="welcome-header">
        <div className="logo-large">FabricVault</div>
        <p className="welcome-subtitle">Secure Wallet for Hyperledger Fabric</p>
      </div>

      <Card
        title="Create New Wallet"
        subtitle="Set a password to secure your wallet">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="newPassword">Password</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              className="input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              className="input"
              required
            />

            <div className="password-hint">
              Use at least 8 characters with letters and numbers
            </div>
          </div>

          {errorMessage && <div className="error-message">{errorMessage}</div>}

          <Button type="submit" fullWidth>
            Create Wallet
          </Button>
        </form>

        {vaultExists && (
          <div className="form-footer">
            <Button
              variant="text"
              onClick={() => navigate({ to: "/unlock-wallet" })}>
              Go to Unlock Wallet
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

export default CreateWallet
