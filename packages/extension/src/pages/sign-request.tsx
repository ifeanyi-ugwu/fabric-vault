import { useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"

import { Button } from "~components/ui/button"
import { useIdentity } from "~contexts/identity"
import { usePeer } from "~contexts/peer"
import { useRequest } from "~contexts/request"
import { approvedCall } from "~services/signing"

const ACTIONS: Record<string, string> = {
  fabric_evaluateTransaction: "Read (changes nothing on the ledger)",
  fabric_submitAsync: "Submit (does not wait for the commit)",
  fabric_submitTransaction: "Submit (waits for the commit)"
}

/**
 * The call this request asks for, read by the parser the signature check
 * uses, so what is shown is what a signature will be checked against.
 */
function describeCall(payload: any) {
  try {
    const identity = payload?.params?.identity
    return {
      call: approvedCall(payload?.method, payload?.params, {
        mspId: identity?.mspId,
        certificate: identity?.certificate
      }),
      identityLabel: identity?.label as string | undefined
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

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
      const response = await sendToBackground({
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
      await sendToBackground({
        name: "reject-sign",
        body: { requestId: request.id }
      })
      window.close()
    } catch (err) {
      setError(`Failed: ${err}`)
    }
  }

  const described = describeCall(request.payload)
  const canApprove = !!selectedIdentity && !!selectedPeer && !!described.call
  // The extension sends its own identity and peer, so the dApp's are not shown.
  const {
    peer: _peer,
    identity: _identity,
    capabilities: _capabilities,
    ...otherParams
  } = request.payload?.params ?? {}

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
            No identity selected. Click the FabricVault icon in your browser
            toolbar to open the extension and select one.
          </div>
        )}
        {!selectedPeer && (
          <div className="request-warning">
            No peer selected. Click the FabricVault icon in your browser toolbar
            to open the extension and select one.
          </div>
        )}

        {described.call ? (
          <>
            <div className="form-group">
              <label>Action</label>
              <p>{ACTIONS[described.call.method]}</p>
            </div>
            <div className="form-group">
              <label>Channel · Chaincode</label>
              <p>
                {described.call.channel} · {described.call.chaincode}
                {described.call.contract ? ` (${described.call.contract})` : ""}
              </p>
            </div>
            <div className="form-group">
              <label>Function and arguments</label>
              <p>{described.call.fn}</p>
              {described.call.args.length > 0 && (
                <ul>
                  {described.call.args.map((arg, i) => (
                    <li key={i}>{JSON.stringify(arg)}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="form-group">
              <label>Signs as</label>
              <p>
                {described.identityLabel ?? "Identity"} ·{" "}
                {described.call.identity.mspId}
              </p>
            </div>
            {selectedPeer && (
              <div className="form-group">
                <label>Sent to</label>
                <p>
                  {selectedPeer.name} · {selectedPeer.endpoint}
                  <br />
                  via {selectedPeer.rpcUrl}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="request-warning">
            This request cannot be signed: {described.error}
          </div>
        )}

        {Object.keys(otherParams).length > 0 && (
          <div className="form-group">
            <label>Other parameters</label>
            <div className="recovery-phrase-container">
              <pre>{JSON.stringify(otherParams, null, 2)}</pre>
            </div>
          </div>
        )}

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
