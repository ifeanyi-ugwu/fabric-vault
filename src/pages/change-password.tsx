import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { useChangePassword } from "~/hooks/use-change-password"

export const ChangePassword = () => {
  const { handleSubmit, errorMessage, loading, successMessage, handleCancel } =
    useChangePassword()

  return (
    <div className="view">
      <Card title="Change Password" subtitle="Update your wallet password">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password</label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              className="input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              className="input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
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

          {successMessage && (
            <div className="success-message">{successMessage}</div>
          )}

          <div className="form-actions">
            <Button variant="outline" onClick={handleCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
