// Token-page number formats (Etherscan's rules, measured in research/token.md). Exact BigInt arithmetic throughout;
// pure, so it runs anywhere (server, client, `node --test`).

const group = (intPart: string) => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const abs = (v: bigint) => (v < 0n ? -v : v)

/** `raw / 10^decimals` rounded half-up to `dp` places, as a scaled integer (the value times 10^dp). */
function roundScaled(raw: bigint, decimals: number, dp: number): bigint {
  if (dp >= decimals) return raw * 10n ** BigInt(dp - decimals)
  const div = 10n ** BigInt(decimals - dp)
  return (raw + div / 2n) / div
}

/** A non-negative scaled integer (value × 10^dp) as "1,234.5600"; `fixed` keeps trailing zeros. */
function scaledText(scaled: bigint, dp: number, fixed: boolean): string {
  const s = scaled.toString().padStart(dp + 1, '0')
  const int = s.slice(0, s.length - dp)
  let frac = dp > 0 ? s.slice(s.length - dp) : ''
  if (!fixed) frac = frac.replace(/0+$/, '')
  return `${group(int)}${frac ? '.' + frac : ''}`
}

/** "100,103,099.0000": the Holders tab's Quantity, always `dp` decimals, rounded half-up. */
export function fixedUnits(raw: string | bigint, decimals: number, dp: number): string {
  const v = typeof raw === 'bigint' ? raw : BigInt(raw)
  return `${v < 0n ? '-' : ''}${scaledText(roundScaled(abs(v), decimals, dp), dp, true)}`
}

/** An exact amount split at the decimal point, so a page can bold the point as Etherscan does ("1,000<b>.</b>5"). */
export function unitParts(raw: string | bigint, decimals: number): { int: string; frac: string | null } {
  const v = typeof raw === 'bigint' ? raw : BigInt(raw)
  const base = 10n ** BigInt(decimals)
  const int = `${v < 0n ? '-' : ''}${group((abs(v) / base).toString())}`
  const frac = decimals > 0 ? (abs(v) % base).toString().padStart(decimals, '0').replace(/0+$/, '') : ''
  return { int, frac: frac === '' ? null : frac }
}

/**
 * `part / whole` as a percentage with `dp` decimals, rounded half-up ("92.3160"); null when there is no whole to
 * divide by. No "%" sign, so callers can add it or wrap it.
 */
export function percentText(part: bigint, whole: bigint, dp: number): string | null {
  if (whole <= 0n) return null
  const scale = 10n ** BigInt(dp + 2)
  const scaled = (part * scale * 2n + whole) / (whole * 2n)
  return scaledText(scaled, dp, true)
}

/** Etherscan's analytics percentages: 2 decimals and "%", with "< 0.01%" for a share too small to show but not zero. */
export function share2(part: bigint, whole: bigint): string {
  const text = percentText(part, whole, 2)
  if (text === null) return '-'
  if (text === '0.00' && part > 0n) return '< 0.01%'
  return `${text}%`
}

const SUFFIXES: [number, string][] = [
  [12, 'T'],
  [9, 'B'],
  [6, 'M'],
  [3, 'K'],
]

/**
 * Compact amount for the holder analytics: "3.46 B", "346.57 M", "1 B" (2 decimals at most, trailing zeros dropped),
 * "999.5" below a thousand.
 */
export function compactUnits(raw: string | bigint, decimals: number): string {
  const v = abs(typeof raw === 'bigint' ? raw : BigInt(raw))
  const one = 10n ** BigInt(decimals)
  for (const [exp, suffix] of SUFFIXES) {
    if (v >= 10n ** BigInt(exp) * one) return `${scaledText(roundScaled(v, decimals + exp, 2), 2, false)} ${suffix}`
  }
  return scaledText(roundScaled(v, decimals, 2), 2, false)
}

/** "1", "10", "1K", "5M": axis labels and the Wallet Depth thresholds. */
export function compactCount(n: number): string {
  for (const [exp, suffix] of SUFFIXES) {
    const unit = 10 ** exp
    if (n >= unit) {
      const v = Math.round((n / unit) * 100) / 100
      return `${v}${suffix}`
    }
  }
  return String(n)
}
