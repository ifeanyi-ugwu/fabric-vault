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

  /**
   * The live grants for a certificate, earliest-expiring first. A certificate
   * can hold several at once, so a caller that can tell which one a request
   * belongs to tries each and then `use`s the one that fits.
   */
  live(certificate: string): SigningGrant<Context>[] {
    const now = this.now()
    this.entries = this.entries.filter(
      (entry) => entry.remaining > 0 && entry.expiresAt > now
    )
    return this.entries
      .filter((entry) => entry.certificate === certificate)
      .sort((a, b) => a.expiresAt - b.expiresAt)
  }

  /** Spends one signature of a grant that `live` returned. */
  use(grant: SigningGrant<Context>): void {
    const entry = this.entries.find((candidate) => candidate === grant)
    if (entry) entry.remaining -= 1
  }

  /** Uses one signature from the earliest-expiring live grant for the certificate. */
  consume(certificate: string): SigningGrant<Context> | null {
    const [earliest] = this.live(certificate)
    if (!earliest) return null
    this.use(earliest)
    return {
      certificate: earliest.certificate,
      origin: earliest.origin,
      context: earliest.context
    }
  }
}
