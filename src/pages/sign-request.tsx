import { useState } from "react"

import { Button } from "~components/ui/button"
import { useIdentity } from "~contexts/identity"
import { usePeer } from "~contexts/peer"
import { useRequest } from "~contexts/request"

export function SignRequest() {
  const { request, loading, error: requestError } = useRequest()
  const { selectedPeer } = usePeer()
  const { selectedIdentity } = useIdentity()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  if (loading) {
    return (
      <div className="container view">
        <div className="content">
          <div className="card">
            <div className="text-center mb-4">
              <div className="logo-large">FabricVault</div>
              <div className="welcome-subtitle">
                Loading transaction request...
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (requestError) {
    return (
      <div className="container view">
        <div className="content">
          <div className="card">
            <div className="card-title text-center">Error</div>
            <div className="error-message text-center">{requestError}</div>
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
            <p className="text-center mb-4">
              No transaction request to handle.
            </p>
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
    if (sending) return
    setSending(true)
    try {
      if (!selectedPeer) {
        throw new Error("Peer is undefined")
      }

      if (!selectedIdentity) {
        throw new Error("Identity is undefined")
      }

      console.log({ payload: request.payload })

      const response = await chrome.runtime.sendMessage({
        type: "SEND_TRANSACTION_REQUEST",
        payload: {
          peer: selectedPeer,
          identity: selectedIdentity,
          request: request
        }
      })

      if (!response || !response.success) {
        throw new Error(
          response?.error || "Failed to initiate transaction in background."
        )
      }

      window.close()
    } catch (err) {
      console.error("Failed to sign transaction:", err)
      setError(`Failed to sign transaction: ${err}`)
    } finally {
      setSending(false)
    }
  }

  const handleReject = async () => {
    try {
      await chrome.runtime.sendMessage({
        type: "REJECT_SIGN_REQUEST",
        id: request.id
      })
      window.close()
    } catch (err) {
      console.error("Failed to reject transaction:", err)
      setError(`Failed to reject transaction: ${err}`)
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
          <div className="card-title">Transaction Approval</div>
          <div className="card-subtitle">
            {request.origin} wants to initiate a transaction that may require
            your signature.
          </div>

          <div className="form-group">
            <label>Transaction Details</label>
            <div className="recovery-phrase-container">
              <pre
                style={{
                  overflow: "auto",
                  maxHeight: "200px",
                  fontSize: "var(--text-xs)"
                }}>
                {JSON.stringify(request.payload, null, 2)}
              </pre>
            </div>
          </div>

          {error && <p className="error-message">{error}</p>}

          <div className="form-actions mt-5">
            <Button variant="outline" onClick={handleReject}>
              Reject
            </Button>
            <Button onClick={handleApprove} disabled={sending}>
              {sending ? "Approving..." : "Approve"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
