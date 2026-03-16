import { useState } from "react"
import { sendToBackground } from "@plasmohq/messaging"

import { Button } from "~components/ui/button"
import type { RequestBody as RejectSignBody } from "~background/messages/reject-sign"
import type {
  RequestBody as SendTransactionBody,
  ResponseBody as SendTransactionResponse
} from "~background/messages/send-transaction"
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
      <div className="request-screen">
        <div className="request-brand">FabricVault</div>
        <p className="request-loading">Loading request…</p>
      </div>
    )
  }

  if (requestError || !request) {
    return (
      <div className="request-screen">
        <div className="request-brand">FabricVault</div>
        <div className="request-card">
          <p className="request-error">
            {requestError || "No transaction request to handle."}
          </p>
          <Button fullWidth onClick={() => window.close()}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  const handleApprove = async () => {
    if (sending) return
    setSending(true)
    try {
      if (!selectedPeer || !selectedIdentity) {
        setError("Select both an identity and a peer before approving.")
        setSending(false)
        return
      }
      const response = await sendToBackground<SendTransactionBody, SendTransactionResponse>({
        name: "send-transaction",
        body: { peer: selectedPeer, identity: selectedIdentity, request }
      })
      if (!response?.success) {
        throw new Error(response?.error || "Failed to initiate transaction.")
      }
      window.close()
    } catch (err) {
      setError(`Failed: ${err}`)
      setSending(false)
    }
  }

  const handleReject = async () => {
    try {
      await sendToBackground<RejectSignBody>({
        name: "reject-sign",
        body: { requestId: request.id }
      })
      window.close()
    } catch (err) {
      setError(`Failed: ${err}`)
    }
  }

  const canApprove = !!selectedIdentity && !!selectedPeer

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

        <h2 className="request-title">Transaction approval</h2>
        <p className="request-desc">
          This site wants to submit a transaction using your identity.
        </p>

        {!selectedIdentity && (
          <div className="request-warning">
            No identity selected. Click the FabricVault icon in your browser toolbar to open the extension and select one.
          </div>
        )}
        {!selectedPeer && (
          <div className="request-warning">
            No peer selected. Click the FabricVault icon in your browser toolbar to open the extension and select one.
          </div>
        )}

        <div className="form-group">
          <label>Transaction payload</label>
          <div className="recovery-phrase-container">
            <pre>{JSON.stringify(request.payload, null, 2)}</pre>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="request-actions">
        <Button variant="outline" onClick={handleReject} disabled={sending}>
          Reject
        </Button>
        <Button onClick={handleApprove} disabled={sending || !canApprove}>
          {sending ? "Approving…" : "Approve"}
        </Button>
      </div>
    </div>
  )
}
