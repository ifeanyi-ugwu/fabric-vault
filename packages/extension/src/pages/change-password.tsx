import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { useChangePassword } from "~/hooks/use-change-password"
import { passwordHint } from "~/utils/validate-password"

export const ChangePassword = () => {
  const { handleSubmit, errorMessage, loading, successMessage, handleCancel } =
    useChangePassword()

  return (
    <div className="view">
      <Card title="Change password" subtitle="Update your wallet password">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="currentPassword">Current password</label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              placeholder="Enter current password"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New password</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              placeholder="Enter new password"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm new password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              placeholder="Confirm new password"
              required
            />
            <div className="password-hint">{passwordHint}</div>
          </div>

          {errorMessage && <div className="error-message">{errorMessage}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}

          <div className="form-actions">
            <Button variant="outline" onClick={handleCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
