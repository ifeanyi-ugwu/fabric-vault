import { useNavigate } from "@tanstack/react-router"

import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { useUnlockWallet } from "~/hooks/use-unlock-wallet"

const UnlockWallet = () => {
  const { errorMessage, loading, handleSubmit } = useUnlockWallet()
  const navigate = useNavigate()

  return (
    <div className="view">
      <div className="welcome-header">
        <div className="logo-large">FabricVault</div>
      </div>

      <Card
        title="Welcome Back"
        subtitle="Enter your password to unlock your wallet">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              className="input"
              required
            />
          </div>

          {errorMessage && <div className="error-message">{errorMessage}</div>}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Unlocking..." : "Unlock"}
          </Button>
        </form>

        <div className="form-footer">
          <Button
            variant="text"
            onClick={() => navigate({ to: "/create-wallet" })}>
            Create a new wallet instead
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default UnlockWallet
