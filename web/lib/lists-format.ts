// Formatting used by the list tables only (lib/format.ts is shared and frozen).
import { formatUnits, usd } from './format'

/** A number split at its decimal point, so a cell can draw the point bold as Etherscan does ("0<b>.</b>1"). */
export interface Pointed {
  int: string
  frac: string | null
}

function split(text: string): Pointed {
  const dot = text.indexOf('.')
  return dot === -1 ? { int: text, frac: null } : { int: text.slice(0, dot), frac: text.slice(dot + 1) }
}

/**
 * Etherscan's Gas Price cell: the price in Gwei, at most 8 decimals, trailing zeros trimmed ("0.1", "0.08069184").
 * A price of a few wei falls below 8 decimals; it is then shown exactly (9 decimals) rather than as 0.
 */
export function gasPriceGwei(wei: string): Pointed {
  const v = BigInt(wei)
  const cut = formatUnits(v, 9, { maxFraction: 8 })
  return split(cut === '0' && v > 0n ? formatUnits(v, 9) : cut)
}

/** Arbiscan's Base Fee cell: Gwei cut (not rounded) to 3 decimals, trailing zeros trimmed ("0.028", "0.1"). */
export function baseFeeGwei(wei: string): Pointed {
  return split(formatUnits(wei, 9, { maxFraction: 3 }))
}

/** Etherscan's Gas Used share: "12.01%", and "0%" when it rounds to nothing (a few gas out of an Arbitrum block's huge limit). */
export function gasUsedPct(used: string, limit: string): { text: string; width: number } {
  const lim = Number(limit)
  const pct = lim === 0 ? 0 : (Number(used) / lim) * 100
  const fixed = pct.toFixed(2)
  return { text: fixed === '0.00' ? '0%' : `${fixed}%`, width: pct }
}

/** `raw / 10^decimals` rounded half-up to exactly `dp` decimals, grouped: "130.11" (Etherscan's stat cards). */
export function fixedUnits(raw: string, decimals: number, dp: number): string {
  const v = BigInt(raw)
  const abs = v < 0n ? -v : v
  const scaled = dp >= decimals ? abs * 10n ** BigInt(dp - decimals) : (abs + 10n ** BigInt(decimals - dp) / 2n) / 10n ** BigInt(decimals - dp)
  const s = scaled.toString().padStart(dp + 1, '0')
  const text = formatUnits(BigInt(s.slice(0, s.length - dp)), 0) + (dp > 0 ? `.${s.slice(s.length - dp)}` : '')
  return v < 0n ? `-${text}` : text
}

/** Dollar value of `raw` token units at `rate` dollars per token. Float is fine: it is an estimate beside the exact amount. */
export function tokenUsd(raw: string, decimals: number, rate: string | null): string | null {
  if (rate === null) return null
  return usd((Number(BigInt(raw)) / 10 ** decimals) * Number(rate))
}
