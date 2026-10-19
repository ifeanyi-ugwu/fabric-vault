import type { Identity } from "~contexts/identity"
import type { Peer } from "~contexts/peer"
import type { RequestData } from "~contexts/request"
import { assertSecureGatewayUrl } from "~lib/gateway-url"
import { buildGatewayParams } from "~lib/request-params"

import { SigningGrants } from "./signing-grants"
import { handleSignRequest } from "./wallet"

// The gateway signs the proposal, and for a submit also the endorsed
// transaction and the commit status request. One signature of margin is added
// to each so a change in the client library's call count does not fail a
// request the user approved.
const SIGNATURES_PER_METHOD: Record<string, number> = {
  fabric_evaluateTransaction: 1,
  fabric_submitAsync: 2,
  fabric_submitTransaction: 3
}
const SIGNATURE_MARGIN = 1
const SIGNING_WINDOW_MS = 2 * 60 * 1000

export async function handleSendRequest(
  peer: Peer,
  identity: Identity,
  request: RequestData
) {
  // The identity was validated against the requesting site when the request
  // arrived, so it wins over the one selected in the popup.
  const signingIdentity: Identity = request.payload.params?.identity ?? identity
  const signatures = SIGNATURES_PER_METHOD[request.payload.method]
  if (signatures === undefined) {
    throw new Error(`Unsupported method: ${request.payload.method}`)
  }
  if (!signingIdentity?.certificate) {
    throw new Error("The request has no identity certificate to sign with.")
  }
  assertSecureGatewayUrl(peer.rpcUrl)

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(peer.rpcUrl)
    const requestId = Math.random().toString(36).substring(2)

    // The user approved this request, which is the only reason this socket
    // exists, so it may ask for exactly this request's signatures.
    const grants = new SigningGrants()
    grants.grant({
      certificate: signingIdentity.certificate,
      origin: request.origin,
      count: signatures + SIGNATURE_MARGIN,
      ttlMs: SIGNING_WINDOW_MS
    })

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          method: request.payload.method,
          params: buildGatewayParams(
            request.payload.params,
            signingIdentity,
            peer
          ),
          id: requestId
        })
      )
    }

    ws.onerror = (err) => {
      console.error("WebSocket error", err)
      reject(new Error("WebSocket connection error"))
      ws.close()
    }

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data)
      if (message.method === "signDigest" && message.params?.digest) {
        const grant = grants.consume(message.params.certificate)
        const signResponse = grant
          ? await handleSignRequest(
              {
                digest: message.params.digest,
                certificate: message.params.certificate
              },
              grant.origin
            )
          : {
              success: false,
              error: "No approved request covers this signature."
            }

        if (signResponse.success) {
          ws.send(
            JSON.stringify({
              jsonrpc: "2.0",
              result: { signature: signResponse.signature },
              id: message.id
            })
          )
        } else {
          ws.send(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32001,
                message: signResponse.error || "Signing failed"
              },
              id: message.id
            })
          )
        }
      } else if (message.result) {
        resolve(message.result)
        ws.close()
      } else if (message.error) {
        reject(new Error(message.error.message))
        ws.close()
      } else {
        reject(
          new Error(
            "handleSendRequest: Unhandled or mismatched WebSocket message:",
            message
          )
        )
      }
    }
  })
}
