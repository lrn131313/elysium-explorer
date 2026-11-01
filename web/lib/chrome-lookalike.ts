// Lookalike addresses (address poisoning): a scammer makes an address whose first and last characters match one the
// victim uses, then plants it in their history, hoping it gets copied instead. Wallets and explorers show addresses
// shortened to those very characters, so two such addresses look the same at a glance.
//
// The rule here is exact and cheap: two different addresses on the same page that share their first 4 and last 4 hex
// characters. By chance that happens once in 16^8 (about 4.3 billion) pairs, so a hit is almost surely deliberate.

const ADDRESS = /^0x[0-9a-f]{40}$/

/** How many hex characters at each end must match. */
export const LOOKALIKE_CHARS = 4

/** The part two lookalikes share: the first and last hex characters. */
export const lookSignature = (a: string) => a.slice(2, 2 + LOOKALIKE_CHARS) + a.slice(-LOOKALIKE_CHARS)

/**
 * The lower-cased addresses among `values` that have a lookalike among the others, sorted. Values that are not a
 * lower-case address (transaction hashes, method names) are ignored.
 */
export function lookalikes(values: Iterable<string>): string[] {
  const groups = new Map<string, Set<string>>()
  for (const v of values) {
    if (!ADDRESS.test(v)) continue
    const key = lookSignature(v)
    const group = groups.get(key)
    if (group === undefined) groups.set(key, new Set([v]))
    else group.add(v)
  }
  const out: string[] = []
  for (const group of groups.values()) if (group.size > 1) out.push(...group)
  return out.sort()
}
