export interface SigningGrant {
  certificate: string
  /** The site whose connection to the certificate authorised the grant. */
  origin: string
}

interface Entry extends SigningGrant {
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
export class SigningGrants {
  private entries: Entry[] = []

  constructor(private now: () => number = Date.now) {}

  grant(options: {
    certificate: string
    origin: string
    count: number
    ttlMs: number
  }): void {
    this.entries.push({
      certificate: options.certificate,
      origin: options.origin,
      remaining: options.count,
      expiresAt: this.now() + options.ttlMs
    })
  }

  /** Uses one signature from the earliest-expiring live grant for the certificate. */
  consume(certificate: string): SigningGrant | null {
    const now = this.now()
    this.entries = this.entries.filter(
      (entry) => entry.remaining > 0 && entry.expiresAt > now
    )
    const live = this.entries
      .filter((entry) => entry.certificate === certificate)
      .sort((a, b) => a.expiresAt - b.expiresAt)[0]
    if (!live) return null
    live.remaining -= 1
    return { certificate: live.certificate, origin: live.origin }
  }
}
