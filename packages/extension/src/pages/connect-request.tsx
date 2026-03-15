import { useState } from "react"
import browser from "webextension-polyfill"

import { Button } from "~/components/ui/button"
import { useIdentity } from "~contexts/identity"
import { usePeer } from "~contexts/peer"
import { useRequest } from "~contexts/request"

export function ConnectRequest() {
  const { request, loading, error } = useRequest()
  const { selectedIdentity } = useIdentity()
  const { selectedPeer } = usePeer()
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="request-screen">
        <div className="request-brand">FabricVault</div>
        <p className="request-loading">Loading request…</p>
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="request-screen">
        <div className="request-brand">FabricVault</div>
        <div className="request-card">
          <p className="request-error">{error || "No connection request to handle."}</p>
          <Button fullWidth onClick={() => window.close()}>Close</Button>
        </div>
      </div>
    )
  }

  const handleApprove = async () => {
    if (!selectedIdentity) return
    try {
      setIsSubmitting(true)
      await browser.runtime.sendMessage({
        type: "APPROVE_CONNECTION_REQUEST",
        id: request.id,
        payload: { identities: [selectedIdentity], origin: request.origin }
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
      await browser.runtime.sendMessage({
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
    <div className="request-screen">
      <div className="request-header">
        <span className="request-brand-sm">FabricVault</span>
        {selectedPeer && (
          <span className="request-peer">
            <span className="status-dot active" />
            {selectedPeer.name}
          </span>
        )}
      </div>

      <div className="request-body">
        <div className="request-origin-badge">
          <span className="request-origin-icon" />
          <span className="request-origin-text">{request.origin}</span>
        </div>

        <h2 className="request-title">Connect request</h2>
        <p className="request-desc">This site is asking to connect to your wallet.</p>

        {selectedIdentity ? (
          <div className="request-identity-preview">
            <div className="request-identity-label">{selectedIdentity.label}</div>
            <div className="request-identity-msp">{selectedIdentity.mspId}</div>
          </div>
        ) : (
          <div className="request-warning">
            No identity selected. Go to your dashboard and select one before connecting.
          </div>
        )}

        <div className="request-permissions">
          <p className="request-permissions-title">This will allow the site to:</p>
          <ul className="request-permissions-list">
            <li>View your identity label, certificate, and MSP ID</li>
            <li>Request your signature for transactions</li>
            <li>Interact with Fabric via this identity (with your approval)</li>
          </ul>
        </div>
      </div>

      <div className="request-actions">
        {!selectedIdentity ? (
          <Button variant="outline" fullWidth onClick={handleReject}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={handleReject} disabled={isSubmitting}>
              Reject
            </Button>
            <Button onClick={handleApprove} disabled={isSubmitting}>
              {isSubmitting ? "Connecting…" : "Connect"}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
