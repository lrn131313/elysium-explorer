// Function names for 4-byte selectors, server-side only: Etherscan's Method column says "Approve" where the backend
// only has 0x095ea7b3.
//
// Blockscout names a method only when the called contract is verified on this chain, and its lists never ask a
// signature service. Elysium has almost no verified contracts, so names come from the Sourcify signature database
// (successor of openchain), one batched lookup per page. Only signatures seen in a verified contract somewhere are
// used: anyone can add a signature to the database and 4-byte collisions are cheap to make, so an unverified-only
// match could put a misleading name on a call. A selector's name never changes, so a found name is kept for the life
// of the process; a selector the database does not know is asked again after an hour.
import { unstable_rethrow } from 'next/navigation'

const LOOKUP_URL = 'https://api.4byte.sourcify.dev/signature-database/v1/lookup'
const UNKNOWN_RETRY_MS = 3_600_000
const TIMEOUT_MS = 3_000
const SELECTOR = /^0x[0-9a-f]{8}$/

interface Candidate {
  name: string // full signature, e.g. approve(address,uint256)
  filtered: boolean // flagged as spam by the database
  hasVerifiedContract: boolean
}

interface LookupReply {
  ok: boolean
  result: { function: Record<string, Candidate[] | null> }
}

const known = new Map<string, string>() // selector -> function name, e.g. 0x095ea7b3 -> approve
const unknownAt = new Map<string, number>()

function bestName(candidates: Candidate[]): string | null {
  const c = candidates.find((x) => x.hasVerifiedContract && !x.filtered)
  if (!c) return null
  const paren = c.name.indexOf('(')
  return paren > 0 ? c.name.slice(0, paren) : null
}

function shouldAsk(selector: string, now: number): boolean {
  if (!SELECTOR.test(selector) || known.has(selector)) return false
  const at = unknownAt.get(selector)
  return at === undefined || now - at > UNKNOWN_RETRY_MS
}

/** Resolves the selectors among `methods` (Blockscout's `method` field) to function names where the database knows them. */
export async function methodNames(methods: readonly (string | null)[]): Promise<ReadonlyMap<string, string>> {
  const now = Date.now()
  const wanted = [...new Set(methods)].filter((m): m is string => m !== null && shouldAsk(m, now))
  if (wanted.length === 0) return known
  try {
    const res = await fetch(`${LOOKUP_URL}?function=${wanted.join(',')}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = (await res.json()) as LookupReply
    if (!body.ok) throw new Error('lookup answered ok=false')
    for (const selector of wanted) {
      const candidates = body.result.function[selector]
      const name = candidates ? bestName(candidates) : null
      if (name) known.set(selector, name)
      else unknownAt.set(selector, now)
    }
  } catch (e) {
    // Next's own control-flow signals must pass through untouched.
    unstable_rethrow(e)
    // Names only decorate the Method column; without them it shows the raw selector, as Etherscan does for unknown
    // ones. Logged so a dead lookup service is visible; the next page render asks again.
    console.error('method names: lookup failed:', e instanceof Error ? e.message : e)
  }
  return known
}

/** The name to show for a transaction's `method`: the looked-up function name, else what Blockscout gave. */
export function shownMethod(method: string | null, names: ReadonlyMap<string, string>): string | null {
  if (method === null) return null
  const name = names.get(method)
  return name === undefined ? method : name
}
