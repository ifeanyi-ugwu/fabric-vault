export interface SigningGrant<Context = undefined> {
  certificate: string
  /** The site whose connection to the certificate authorised the grant. */
  origin: string
  /** What the grant was issued for, handed back with every signature it allows. */
  context: Context
}

interface Entry<Context> extends SigningGrant<Context> {
  remaining: number
  expiresAt: number
}

/**
 * Signatures a gateway socket may ask for. A grant is created when the user
 * approves a request (or a connected site subscribes) and allows a bounded
 * number of signatures for one certificate for a bounded time. A signature
 * request that matches no live grant is refused, so a gateway cannot ask for
 * signatures outside a request the user or a connected site started.
 */
export class SigningGrants<Context = undefined> {
  private entries: Entry<Context>[] = []

  constructor(private now: () => number = Date.now) {}

  grant(
    options: {
      certificate: string
      origin: string
      count: number
      ttlMs: number
    } & (Context extends undefined
      ? { context?: undefined }
      : { context: Context })
  ): void {
    this.entries.push({
      certificate: options.certificate,
      origin: options.origin,
      context: options.context as Context,
      remaining: options.count,
      expiresAt: this.now() + options.ttlMs
    })
  }

  /** Uses one signature from the earliest-expiring live grant for the certificate. */
  consume(certificate: string): SigningGrant<Context> | null {
    const now = this.now()
    this.entries = this.entries.filter(
      (entry) => entry.remaining > 0 && entry.expiresAt > now
    )
    const live = this.entries
      .filter((entry) => entry.certificate === certificate)
      .sort((a, b) => a.expiresAt - b.expiresAt)[0]
    if (!live) return null
    live.remaining -= 1
    return {
      certificate: live.certificate,
      origin: live.origin,
      context: live.context
    }
  }
}
