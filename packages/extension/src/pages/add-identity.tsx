import { useNavigate } from "@tanstack/react-router"

import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { DropZone } from "~/components/ui/drop-zone"
import { useAddIdentity } from "~/hooks/use-add-identity"

export function AddIdentity() {
  const navigate = useNavigate()

  const {
    handleSubmit,
    handleCertificateFile,
    certificateFileName,
    errorMessage
  } = useAddIdentity()

  return (
    <div className="view">
      <Card title="Add Identity" subtitle="Add a new identity to your wallet">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="label">Label</label>
            <input type="text" id="label" name="label" placeholder="e.g. admin" required />
          </div>

          <div className="form-group">
            <label htmlFor="organization">Organization MSP</label>
            <input type="text" id="organization" name="organization" placeholder="e.g. Org1MSP" required />
          </div>

          <div className="form-group">
            <label>Certificate File</label>
            <DropZone
              accept=".pem,.crt"
              fileName={certificateFileName}
              onChange={handleCertificateFile}
              placeholder="Drop .pem or .crt, or click to browse"
            />
          </div>

          <div className="form-group">
            <label htmlFor="privateKey">Private Key (PEM)</label>
            <textarea
              id="privateKey"
              name="privateKey"
              rows={4}
              placeholder="-----BEGIN PRIVATE KEY-----"
              required
            />
          </div>

          {errorMessage && (
            <div className="error-message">{errorMessage}</div>
          )}

          <div className="form-actions">
            <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
              Cancel
            </Button>
            <Button type="submit">Add Identity</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
