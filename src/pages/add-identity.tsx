import { useNavigate } from "@tanstack/react-router"

import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { useAddIdentity } from "~/hooks/use-add-identity"

export function AddIdentity() {
  const navigate = useNavigate()

  const {
    handleSubmit,
    handleCertificateChange,
    certificateFileContent,
    errorMessage
  } = useAddIdentity()

  return (
    <div className="view">
      <Card title="Add Identity" subtitle="Add a new identity to your wallet">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Label</label>
            <input type="text" id="label" name="label" required />
          </div>

          <div className="form-group">
            <label htmlFor="organization">Organization MSP</label>
            <input type="text" id="organization" name="organization" required />
          </div>

          <div className="form-group">
            <label htmlFor="certificate">Certificate File</label>
            <input
              type="file"
              id="certificate"
              name="certificate"
              accept=".pem, .crt"
              onChange={handleCertificateChange}
              required
            />
            {certificateFileContent && (
              <p className="text-sm text-gray-500 mt-1">
                Certificate file uploaded.
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="privateKey">Private Key (PEM)</label>
            <textarea id="privateKey" name="privateKey" rows={5} required />
          </div>

          {errorMessage && (
            <div className="error-message">
              <p className="text-red-500">{errorMessage}</p>
            </div>
          )}

          <div className="form-actions">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/dashboard" })}>
              Cancel
            </Button>
            <Button type="submit">Add Identity</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
