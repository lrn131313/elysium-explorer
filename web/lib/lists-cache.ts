// The in-process cache behind the lists team's measured totals (lib/lists-api.ts).

/**
 * Results kept per key for `ttlMs` and shared by concurrent callers: the first caller's Promise is stored before it
 * settles, so a burst of identical requests runs the work once. A Promise that rejects is removed at once, so the next
 * caller retries instead of reading the failure for `ttlMs`; the callers already waiting on it still get the rejection.
 * Bounded: every insert drops the expired entries, then the oldest (by insertion order) beyond `maxEntries`.
 */
export class SharedCache<T> {
  private readonly entries = new Map<string, { at: number; value: Promise<T> }>()
  private readonly ttlMs: number
  private readonly maxEntries: number

  constructor(ttlMs: number, maxEntries: number) {
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
  }

  get(key: string, work: () => Promise<T>): Promise<T> {
    const now = Date.now()
    const hit = this.entries.get(key)
    if (hit !== undefined && now - hit.at < this.ttlMs) return hit.value
    const value = work()
    this.entries.delete(key)
    for (const [k, e] of this.entries) if (now - e.at >= this.ttlMs) this.entries.delete(k)
    for (const k of this.entries.keys()) {
      if (this.entries.size < this.maxEntries) break
      this.entries.delete(k)
    }
    this.entries.set(key, { at: now, value })
    // Only forgets the failed entry; the rejection itself still reaches every caller awaiting `value`.
    value.then(undefined, () => this.forget(key, value))
    return value
  }

  private forget(key: string, value: Promise<T>): void {
    const current = this.entries.get(key)
    if (current !== undefined && current.value === value) this.entries.delete(key)
  }
}
