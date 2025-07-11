import { useState } from "react"

import { useIdentity } from "~contexts/identity"
import { usePeer } from "~contexts/peer"
import { useRequest } from "~contexts/request"

export function ConnectRequest() {
  const { request, loading, error } = useRequest()
  const { selectedIdentity } = useIdentity()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { selectedPeer } = usePeer()

  if (loading) {
    return (
      <div className="container view">
        <div className="content">
          <div className="card">
            <div className="text-center mb-4">
              <div className="logo-large">FabricVault</div>
              <div className="welcome-subtitle">
                Loading connection request...
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container view">
        <div className="content">
          <div className="card">
            <div className="card-title text-center">Error</div>
            <div className="error-message text-center">{error}</div>
            <button
              className="button button-primary full-width mt-4"
              onClick={() => window.close()}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="container view">
        <div className="content">
          <div className="card">
            <div className="card-title text-center">No Request</div>
            <p className="text-center mb-4">No connection request to handle.</p>
            <button
              className="button button-primary full-width"
              onClick={() => window.close()}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleApprove = async () => {
    try {
      if (!selectedIdentity) return

      setIsSubmitting(true)
      await chrome.runtime.sendMessage({
        type: "APPROVE_CONNECTION_REQUEST",
        id: request.id,
        payload: {
          identities: [selectedIdentity],
          origin: request.origin
        }
      })
      window.close()
    } catch (err) {
      setIsSubmitting(false)
      console.error("Failed to approve connection:", err)
    }
  }

  const handleReject = async () => {
    try {
      setIsSubmitting(true)
      await chrome.runtime.sendMessage({
        type: "REJECT_CONNECTION_REQUEST",
        id: request.id
      })
      window.close()
    } catch (err) {
      setIsSubmitting(false)
      console.error("Failed to reject connection:", err)
    }
  }

  return (
    <div className="container view">
      <div className="header">
        <div className="logo">FabricVault</div>
        <div className="network-status">
          <span className="status-dot active"></span>
          <span className="network-name">{selectedPeer?.name}</span>
        </div>
      </div>

      <div className="content">
        <div className="card">
          <div className="card-title">Connection Request</div>

          <div className="card-content">
            <div className="mb-4">
              <strong>{request.origin}</strong> wants to connect to your Vault
            </div>

            {selectedIdentity && (
              <div className="id-card mb-4">
                <div className="id-card-header">
                  <div className="id-name">{selectedIdentity.label}</div>
                  <div className="active-badge">Active</div>
                </div>
                <div className="id-details">
                  <div className="id-org">{selectedIdentity.mspId}</div>
                </div>
              </div>
            )}

            {!selectedIdentity && (
              <div className="form-help mb-4 text-danger text-bold text-center">
                🤔 You haven't selected an identity yet.
                <br />
                If you haven't added one, you'll need to do that first.
                <br />
                Head to your dashboard to add or pick the one you'd like to use.
              </div>
            )}

            <div className="form-help mb-4">
              This will allow the application to:
              <ul className="mt-2" style={{ paddingLeft: "var(--space-4)" }}>
                <li>
                  View key identity details such as its label, certificate, and
                  MSP ID
                </li>
                <li>
                  Request your signature for transactions involving this
                  identity
                </li>
                <li>
                  With your approval, interact with the Fabric network using
                  this identity
                </li>
              </ul>
            </div>

            <div className="form-actions">
              {!selectedIdentity ? (
                <button
                  className="button button-secondary full-width"
                  onClick={handleReject}>
                  Close
                </button>
              ) : (
                <>
                  <button
                    className="button button-outline"
                    onClick={handleReject}
                    disabled={isSubmitting}>
                    Reject
                  </button>
                  <button
                    className="button button-primary"
                    onClick={handleApprove}
                    disabled={isSubmitting}>
                    Connect
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
