import {
  SigningSession,
  VerificationError,
  type ApprovedCall,
  type ApprovedIdentity,
  type ApprovedSubscription,
  type SignKind
} from "../lib/fabric/session"
import type { SigningGrants } from "./signing-grants"

/** Refusal code in the replies the extension sends to a gateway. */
export const SIGNING_REFUSED = -32001

const SIGN_KINDS: ReadonlySet<string> = new Set<SignKind>([
  "proposal",
  "transaction",
  "commit",
  "chaincodeEvents",
  "blockEvents"
])

/** What a grant was issued for: the checks its signatures must pass. */
export interface SigningContext {
  session: SigningSession
  /** Accept a `signDigest` request, which carries no bytes to check. */
  allowLegacyDigest: boolean
}

export type Sign = (
  digestBase64: string,
  certificate: string,
  origin: string
) => Promise<{ success: boolean; signature?: string; error?: string }>

export type SigningReply =
  | { result: { signature: string } }
  | { error: { code: number; message: string } }

const refuse = (message: string): SigningReply => ({
  error: { code: SIGNING_REFUSED, message }
})

const toBase64 = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))

const fromBase64 = (text: string) =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0))

/**
 * Answers a `signRequest` or `signDigest` message from a gateway, or returns
 * null for any other message. A request needs a live grant for its
 * certificate, and a `signRequest` must also pass the grant's session.
 */
export async function answerSigningRequest(
  message: any,
  grants: SigningGrants<SigningContext>,
  sign: Sign
): Promise<SigningReply | null> {
  const method = message?.method
  if (method !== "signRequest" && method !== "signDigest") return null

  const certificate = message.params?.certificate
  if (typeof certificate !== "string" || certificate === "") {
    return refuse("Certificate not provided for signing.")
  }
  // A certificate can hold several grants at once, for example two
  // subscriptions on one socket, and the request carries nothing that says
  // which it belongs to. Each is tried, earliest first, and the first whose
  // session accepts the request is the one that pays for the signature.
  const candidates = grants.live(certificate)
  if (candidates.length === 0) {
    return refuse("No approved request covers this signature.")
  }

  let grant: (typeof candidates)[number] | undefined
  let digest: string
  if (method === "signRequest") {
    const { kind, bytes } = message.params
    if (!SIGN_KINDS.has(kind) || typeof bytes !== "string") {
      return refuse("Malformed signature request.")
    }
    let decoded: Uint8Array
    try {
      decoded = fromBase64(bytes)
    } catch (error) {
      if (error instanceof DOMException) {
        return refuse("Malformed signature request.")
      }
      throw error
    }
    let firstRefusal: string | undefined
    digest = ""
    for (const candidate of candidates) {
      try {
        digest = toBase64(await candidate.context.session.verify(kind, decoded))
        grant = candidate
        break
      } catch (error) {
        if (!(error instanceof VerificationError)) throw error
        firstRefusal ??= error.message
      }
    }
    if (!grant) return refuse(firstRefusal ?? "Signing refused.")
  } else {
    grant = candidates.find((candidate) => candidate.context.allowLegacyDigest)
    if (!grant) {
      return refuse(
        "This gateway asks for a digest, which the extension cannot check. Turn on legacy signing for the peer to allow it."
      )
    }
    if (typeof message.params?.digest !== "string") {
      return refuse("Digest not provided for signing.")
    }
    digest = message.params.digest
  }
  grants.use(grant)

  const signed = await sign(digest, certificate, grant.origin)
  return signed.success && signed.signature !== undefined
    ? { result: { signature: signed.signature } }
    : refuse(signed.error ?? "Signing failed")
}

const SUBMIT_METHODS = new Set<ApprovedCall["method"]>([
  "fabric_evaluateTransaction",
  "fabric_submitAsync",
  "fabric_submitTransaction"
])

const isText = (value: unknown): value is string =>
  typeof value === "string" && value !== ""

/** The chaincode name, and the contract when the dApp names one. */
function chaincodeOf(chaincode: unknown): { name: string; contract?: string } {
  if (isText(chaincode)) return { name: chaincode }
  const named = chaincode as { name?: unknown; contract?: unknown } | null
  if (named && typeof named === "object" && isText(named.name)) {
    if (named.contract !== undefined && !isText(named.contract)) {
      throw new Error("The request names an invalid contract.")
    }
    return { name: named.name, contract: named.contract as string | undefined }
  }
  throw new Error("The request names no chaincode.")
}

/** The call a dApp request asks for, in the form the verifier compares to. */
export function approvedCall(
  method: string,
  params: any,
  identity: ApprovedIdentity
): ApprovedCall {
  if (!SUBMIT_METHODS.has(method as ApprovedCall["method"])) {
    throw new Error(`Unsupported method: ${method}`)
  }
  if (!isText(params?.channel) || !isText(params?.fn)) {
    throw new Error("The request names no channel or function.")
  }
  const args = params.args ?? []
  if (!Array.isArray(args) || !args.every((arg) => typeof arg === "string")) {
    throw new Error("The request has arguments that are not strings.")
  }
  const { name, contract } = chaincodeOf(params.chaincode)
  return {
    method: method as ApprovedCall["method"],
    channel: params.channel,
    chaincode: name,
    contract,
    fn: params.fn,
    args,
    identity
  }
}

/** The event subscription a dApp request asks for. */
export function approvedSubscription(
  params: any,
  identity: ApprovedIdentity
): ApprovedSubscription {
  if (!isText(params?.channel)) {
    throw new Error("The request names no channel.")
  }
  if (params.eventType === "block") {
    return { method: "blockEvents", channel: params.channel, identity }
  }
  if (params.eventType === "chaincode") {
    return {
      method: "chaincodeEvents",
      channel: params.channel,
      chaincode: chaincodeOf(params.chaincode).name,
      identity
    }
  }
  throw new Error("The request names an unknown event type.")
}
