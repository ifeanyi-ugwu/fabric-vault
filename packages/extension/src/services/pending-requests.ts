interface Entry {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  answered: boolean
  timer: ReturnType<typeof setTimeout>
}

export interface Timers {
  set: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>
  clear: (timer: ReturnType<typeof setTimeout>) => void
}

/**
 * Requests that wait on the user. A request is open until it settles. It
 * settles when the user answers, when its popup closes unanswered, or when it
 * times out unanswered. `onSettled` runs once per request however it ends, so
 * the request's stored state is removed in one place.
 *
 * A request is answered once the user has approved it, even if the work it
 * triggers is still running: closing the popup then, as the popup does itself
 * after Approve, does not cancel it.
 */
export class PendingRequests {
  private entries = new Map<string, Entry>()

  constructor(
    private options: {
      /** How long an unanswered request waits for the user. */
      timeoutMs: number
      onSettled: (id: string) => void
      timers?: Timers
    }
  ) {}

  private get timers(): Timers {
    return this.options.timers ?? { set: setTimeout, clear: clearTimeout }
  }

  /** Registers a request and returns the promise its settling resolves or rejects. */
  open(id: string): Promise<unknown> {
    if (this.entries.has(id)) {
      return Promise.reject(
        new Error("A request with this id is already open.")
      )
    }
    return new Promise((resolve, reject) => {
      const timer = this.timers.set(
        () => this.cancelUnanswered(id, "The request timed out."),
        this.options.timeoutMs
      )
      this.entries.set(id, { resolve, reject, answered: false, timer })
    })
  }

  has(id: string): boolean {
    return this.entries.has(id)
  }

  /** Resolves a request. Returns false when none is open under the id. */
  resolve(id: string, value: unknown): boolean {
    return this.settle(id, (entry) => entry.resolve(value))
  }

  /** Rejects a request. Returns false when none is open under the id. */
  reject(id: string, error: Error): boolean {
    return this.settle(id, (entry) => entry.reject(error))
  }

  /** The user approved: closing the popup no longer cancels, and the timeout stops. */
  answered(id: string): void {
    const entry = this.entries.get(id)
    if (!entry) return
    entry.answered = true
    this.timers.clear(entry.timer)
  }

  /** The popup closed. Cancels the request unless the user already answered it. */
  popupClosed(id: string): void {
    this.cancelUnanswered(id, "The request was closed without an answer.")
  }

  /** The page that asked is gone, so nothing is waiting for the result. */
  forget(id: string): void {
    this.settle(id, () => {})
  }

  private cancelUnanswered(id: string, reason: string): void {
    const entry = this.entries.get(id)
    if (entry && !entry.answered) this.reject(id, new Error(reason))
  }

  private settle(id: string, apply: (entry: Entry) => void): boolean {
    const entry = this.entries.get(id)
    if (!entry) return false
    this.entries.delete(id)
    this.timers.clear(entry.timer)
    apply(entry)
    this.options.onSettled(id)
    return true
  }
}
