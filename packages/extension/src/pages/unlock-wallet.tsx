import { useNavigate } from "@tanstack/react-router"

import { Button } from "~/components/ui/button"
import { useUnlockWallet } from "~/hooks/use-unlock-wallet"

const UnlockWallet = () => {
  const { errorMessage, loading, handleSubmit } = useUnlockWallet()
  const navigate = useNavigate()

  return (
    <div className="view onboarding-view">
      <div className="onboarding-brand">
        <div className="logo-large">FabricVault</div>
      </div>

      <div className="onboarding-card">
        <h2 className="onboarding-title">Welcome back</h2>
        <p className="onboarding-subtitle">Enter your password to unlock</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="Your wallet password"
              autoFocus
              required
            />
          </div>

          {errorMessage && <div className="error-message">{errorMessage}</div>}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Unlocking…" : "Unlock"}
          </Button>
        </form>

        <div className="onboarding-footer">
          <Button variant="text" onClick={() => navigate({ to: "/create-wallet" })}>
            Create a new wallet instead
          </Button>
        </div>
      </div>
    </div>
  )
}

export default UnlockWallet
