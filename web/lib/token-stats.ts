// The Holders tab's analytics (Etherscan's "Holders Overview", no-price variant), computed from a full list of holder
// balances. Rules and thresholds from research/token.md §1.8. Pure and exact (BigInt); only the Gini score and the
// chart lengths become floats at the very end.

export interface Cohort {
  label: string
  amount: bigint
}

export interface Tier {
  name: string
  /** "Wallets holding more than 100,000 SYM", without the symbol (the page adds it). */
  rule: { above: number | null; upTo: number | null }
  count: number
  amount: bigint
}

export interface Depth {
  /** Threshold in whole tokens; a holder counts when its balance is strictly greater. */
  above: number
  label: string
  count: number
}

export interface HolderStats {
  holders: number
  supply: bigint
  cohorts: Cohort[]
  top5: bigint
  top10: bigint
  top100: bigint
  tiers: Tier[]
  /** The Whale tier (more than 100,000 whole tokens), for the Whale Concentration card. */
  whales: { count: number; amount: bigint }
  depth: Depth[]
  /** Population Gini over all holder balances, 0 (equal) to 1 (one holder owns all). Null with no balances. */
  gini: number | null
  /** Holders owning at least 1% of the supply. */
  atLeastOnePercent: number
}

const COHORTS: { label: string; from: number; to: number }[] = [
  { label: 'Top 1-5', from: 0, to: 5 },
  { label: 'Top 6-10', from: 5, to: 10 },
  { label: 'Top 11-25', from: 10, to: 25 },
  { label: 'Top 26-50', from: 25, to: 50 },
  { label: 'Top 51-100', from: 50, to: 100 },
  { label: 'Outside 100', from: 100, to: Number.POSITIVE_INFINITY },
]

/** Strict lower bound, inclusive upper bound, in whole tokens. */
const WHALE_ABOVE = 100_000

const TIERS: { name: string; above: number | null; upTo: number | null }[] = [
  { name: 'Whale', above: WHALE_ABOVE, upTo: null },
  { name: 'Shark', above: 10_000, upTo: 100_000 },
  { name: 'Dolphin', above: 1_000, upTo: 10_000 },
  { name: 'Fish', above: 100, upTo: 1_000 },
  { name: 'Crab', above: 10, upTo: 100 },
  { name: 'Shrimp', above: null, upTo: 10 },
]

const DEPTH: { above: number; label: string }[] = [
  { above: 10, label: '10' },
  { above: 50, label: '50' },
  { above: 100, label: '100' },
  { above: 250, label: '250' },
  { above: 500, label: '500' },
  { above: 1_000, label: '1k' },
  { above: 10_000, label: '10k' },
  { above: 100_000, label: '100k' },
  { above: 1_000_000, label: '1M' },
]

const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n)

/**
 * Population Gini without the n/(n-1) correction (it reproduces Etherscan's figure; the corrected form does not):
 * G = Σ (2i − n − 1)·x_i / (n · Σx), x sorted ascending, i from 1. Exact up to the final division.
 */
export function gini(ascending: bigint[]): number | null {
  const n = BigInt(ascending.length)
  const total = sum(ascending)
  if (n === 0n || total === 0n) return null
  let weighted = 0n
  ascending.forEach((x, i) => {
    weighted += (2n * BigInt(i + 1) - n - 1n) * x
  })
  const SCALE = 10n ** 12n
  return Number((weighted * SCALE) / (n * total)) / Number(SCALE)
}

/** All the analytics for one token. `balances` in raw units (any order); `supply` the token's total supply, raw. */
export function holderStats(balances: bigint[], decimals: number, supply: bigint): HolderStats {
  const desc = [...balances].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))
  const one = 10n ** BigInt(decimals)
  const whole = (n: number) => BigInt(n) * one

  const cohorts = COHORTS.map((c) => ({ label: c.label, amount: sum(desc.slice(c.from, Number.isFinite(c.to) ? c.to : undefined)) }))

  const tiers = TIERS.map((t) => {
    const inside = desc.filter((b) => (t.above === null || b > whole(t.above)) && (t.upTo === null || b <= whole(t.upTo)))
    return { name: t.name, rule: { above: t.above, upTo: t.upTo }, count: inside.length, amount: sum(inside) }
  })

  const whaleBalances = desc.filter((b) => b > whole(WHALE_ABOVE))

  const depth = DEPTH.map((d) => ({ above: d.above, label: d.label, count: desc.filter((b) => b > whole(d.above)).length }))

  return {
    holders: desc.length,
    supply,
    cohorts,
    top5: sum(desc.slice(0, 5)),
    top10: sum(desc.slice(0, 10)),
    top100: sum(desc.slice(0, 100)),
    tiers,
    whales: { count: whaleBalances.length, amount: sum(whaleBalances) },
    depth,
    gini: gini([...desc].reverse()),
    atLeastOnePercent: supply > 0n ? desc.filter((b) => b * 100n >= supply).length : 0,
  }
}
