import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"

import { Button } from "~components/ui/button"
import { usePeer } from "~contexts/peer"
import { useRequest } from "~contexts/request"
import { parsePeerRequest, samePeer } from "~lib/peer-request"

/** SHA-256 of the PEM text, in the colon-separated form certificates are compared in. */
async function fingerprint(pem: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(pem)
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0").toUpperCase()
  ).join(":")
}

export function PeerRequest() {
  const { request, loading, error: requestError } = useRequest()
  const { peers, selectedPeer } = usePeer()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState("")
  const [certFingerprint, setCertFingerprint] = useState<string | null>(null)

  let peer: ReturnType<typeof parsePeerRequest> | null = null
  let invalid = ""
  try {
    if (request) peer = parsePeerRequest(request.payload?.params)
  } catch (cause) {
    invalid = cause instanceof Error ? cause.message : String(cause)
  }

  const certificate = peer?.tlsRootCert ?? null
  useEffect(() => {
    setCertFingerprint(null)
    if (certificate) void fingerprint(certificate).then(setCertFingerprint)
  }, [certificate])

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
            {requestError || "No peer request to handle."}
          </p>
          <Button fullWidth onClick={() => window.close()}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  const wanted = peer
  const known = wanted
    ? peers.some((candidate) => samePeer(candidate, wanted))
    : false
  const current =
    wanted && selectedPeer ? samePeer(selectedPeer, wanted) : false

  const answer = async (approve: boolean) => {
    if (working) return
    setWorking(true)
    try {
      const body = { requestId: request.id }
      const response = approve
        ? await sendToBackground({ name: "approve-peer", body })
        : await sendToBackground({ name: "reject-peer", body })
      if (!response?.success) {
        const failure = "error" in response ? response.error : undefined
        throw new Error(
          typeof failure === "string" && failure
            ? failure
            : "The request failed."
        )
      }
      window.close()
    } catch (cause) {
      setError(`Failed: ${cause}`)
      setWorking(false)
    }
  }

  return (
    <div className="request-screen">
      <div className="request-header">
        <span className="request-brand-sm">FabricVault</span>
      </div>

      <div className="request-body">
        <div className="request-origin-badge">
          <span className="request-origin-icon" />
          <span className="request-origin-text">{request.origin}</span>
        </div>

        <h2 className="request-title">
          {known ? "Switch peer" : "Add and use a new peer"}
        </h2>
        <p className="request-desc">
          This site wants the wallet to send its transactions through the peer
          below. Approve only a peer you trust.
        </p>

        {peer ? (
          <>
            <div className="form-group">
              <label>Name</label>
              <p>{peer.name}</p>
            </div>
            <div className="form-group">
              <label>Peer endpoint</label>
              <p>{peer.endpoint}</p>
            </div>
            <div className="form-group">
              <label>Gateway</label>
              <p>{peer.rpcUrl}</p>
              <p>
                <small>
                  The gateway sees every transaction you send through this peer,
                  with its arguments and results. It never sees your private
                  key.
                </small>
              </p>
            </div>
            <div className="form-group">
              <label>TLS root certificate</label>
              <p>
                {peer.tlsRootCert
                  ? certFingerprint ?? "Calculating fingerprint…"
                  : "None: the system's trusted roots apply"}
              </p>
            </div>
            {current && (
              <div className="request-warning">
                This peer is already selected. Approving changes nothing.
              </div>
            )}
          </>
        ) : (
          <div className="request-warning">
            This request cannot be approved: {invalid}
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="request-actions">
        <Button
          variant="outline"
          onClick={() => answer(false)}
          disabled={working}>
          Reject
        </Button>
        <Button onClick={() => answer(true)} disabled={working || !peer}>
          {working ? "Working…" : known ? "Switch" : "Add and use"}
        </Button>
      </div>
    </div>
  )
}
