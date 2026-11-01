// Formatting shared by the chain team's server and client components (a plain module, so both sides can call it).

/**
 * USD with enough decimals to show a fraction of a cent ("$0.0002"), where lib/format's `usd` writes "< $0.01": on
 * Elysium a whole transaction costs less than a cent. An estimate beside exact amounts, so floats are fine.
 */
export function smallUsd(v: number): string {
  if (v >= 0.01) return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (v === 0) return '$0.00'
  const digits = Math.min(12, 1 - Math.floor(Math.log10(v)))
  return '$' + v.toFixed(digits).replace(/0+$/, '')
}

/** What `gas` units cost in USD at `weiPerGas`, with the coin at `rate` dollars. */
export const gasUsd = (gas: number, weiPerGas: string, rate: number) => smallUsd(((gas * Number(weiPerGas)) / 1e18) * rate)
