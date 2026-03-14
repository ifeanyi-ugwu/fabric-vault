import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { Button } from "~/components/ui/button"
import { useVault } from "~/contexts/vault"
import { useCreateWallet } from "~/hooks/use-create-wallet"
import { passwordHint } from "~/utils/validate-password"

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
    <div className="view onboarding-view">
      <div className="onboarding-brand">
        <div className="logo-large">FabricVault</div>
        <p className="welcome-subtitle">Secure wallet for Hyperledger Fabric</p>
      </div>

      <div className="onboarding-card">
        <h2 className="onboarding-title">Create wallet</h2>
        <p className="onboarding-subtitle">Set a password to protect your keys</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="newPassword">Password</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              placeholder="Enter a password"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              placeholder="Confirm your password"
              required
            />
            <div className="password-hint">{passwordHint}</div>
          </div>

          {errorMessage && <div className="error-message">{errorMessage}</div>}

          <Button type="submit" fullWidth>
            Create wallet
          </Button>
        </form>

        {vaultExists && (
          <div className="onboarding-footer">
            <Button variant="text" onClick={() => navigate({ to: "/unlock-wallet" })}>
              Unlock existing wallet
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CreateWallet
