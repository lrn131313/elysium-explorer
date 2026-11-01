// Display formatting. Amounts stay exact: wei strings go through BigInt, never through floating point.

export const COIN = 'HYPE'

const group = (intPart: string) => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/**
 * Exact decimal string of `raw` scaled down by `decimals` (trailing zeros trimmed), with thousands separators unless
 * `grouped` is false (CSV files: a spreadsheet reads "1,234.5" as text).
 */
export function formatUnits(raw: string | bigint, decimals = 18, opts: { maxFraction?: number; grouped?: boolean } = {}): string {
  const v = typeof raw === 'bigint' ? raw : BigInt(raw)
  const neg = v < 0n
  const abs = neg ? -v : v
  const base = 10n ** BigInt(decimals)
  const int = (abs / base).toString()
  let frac = decimals > 0 ? (abs % base).toString().padStart(decimals, '0') : ''
  if (opts.maxFraction !== undefined && frac.length > opts.maxFraction) frac = frac.slice(0, opts.maxFraction)
  frac = frac.replace(/0+$/, '')
  return `${neg ? '-' : ''}${opts.grouped === false ? int : group(int)}${frac ? '.' + frac : ''}`
}

/** `raw / 10^decimals` rounded half-up to `dp` places, as a scaled integer (the value times 10^dp). */
function roundScaled(abs: bigint, decimals: number, dp: number): bigint {
  if (dp >= decimals) return abs * 10n ** BigInt(dp - decimals)
  const div = 10n ** BigInt(decimals - dp)
  return (abs + div / 2n) / div
}

/** A scaled integer (value × 10^dp) as "1,234.56", trailing zeros trimmed unless `fixed`. */
function scaledText(scaled: bigint, dp: number, fixed = false): string {
  const s = scaled.toString().padStart(dp + 1, '0')
  const int = s.slice(0, s.length - dp)
  let frac = dp > 0 ? s.slice(s.length - dp) : ''
  if (!fixed) frac = frac.replace(/0+$/, '')
  return `${group(int)}${frac ? '.' + frac : ''}`
}

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const subscript = (n: number) => [...String(n)].map((d) => SUB.charAt(Number(d))).join('')

/**
 * Etherscan's short form for a positive amount below the shown precision: "0.0₁₀1234" reads 0.[ten zeros]1234.
 * Never prints a non-zero amount as 0.
 */
function tiny(abs: bigint, decimals: number): string {
  const frac = abs.toString().padStart(decimals, '0')
  const zeros = frac.length - frac.replace(/^0+/, '').length
  const digits = frac.slice(zeros, zeros + 4).replace(/0+$/, '')
  return `0.0${subscript(zeros)}${digits}`
}

/** Coin amounts in lists: up to 9 decimals, rounded, trailing zeros trimmed; tiny non-zero values in subscript form. */
export function listCoin(raw: string | bigint, decimals = 18): string {
  const v = typeof raw === 'bigint' ? raw : BigInt(raw)
  const abs = v < 0n ? -v : v
  const scaled = roundScaled(abs, decimals, 9)
  const text = scaled === 0n && abs > 0n ? tiny(abs, decimals) : scaledText(scaled, 9)
  return `${v < 0n ? '-' : ''}${text}`
}

/** Etherscan's Txn Fee cell: always 8 decimals, "0" for zero. Split so the page can bold the point. */
export function fee8(wei: string | bigint): { int: string; frac: string | null } {
  const v = typeof wei === 'bigint' ? wei : BigInt(wei)
  if (v === 0n) return { int: '0', frac: null }
  const text = scaledText(roundScaled(v, 18, 8), 8, true)
  const dot = text.indexOf('.')
  return { int: text.slice(0, dot), frac: text.slice(dot + 1) }
}

const COMPACT: [number, string][] = [
  [12, 'T'],
  [9, 'B'],
  [6, 'M'],
]
/** Where the token page starts writing "221.53 M"; Etherscan's own cut-off is between 4.2 M and 221 M (not measured). */
const COMPACT_FROM = 10n ** 7n

/**
 * Token amounts on a token's Transfers tab, by size as Etherscan does: from 10 M "221.53 M" / "1 B"; from 10
 * two decimals; from 1 six decimals; below 1 full precision.
 */
export function tokenTabAmount(raw: string | bigint, decimals: number): string {
  const v = typeof raw === 'bigint' ? raw : BigInt(raw)
  const abs = v < 0n ? -v : v
  const sign = v < 0n ? '-' : ''
  const one = 10n ** BigInt(decimals)
  if (abs >= COMPACT_FROM * one) {
    for (const [exp, suffix] of COMPACT) {
      if (abs >= 10n ** BigInt(exp) * one) return `${sign}${scaledText(roundScaled(abs, decimals + exp, 2), 2)} ${suffix}`
    }
  }
  if (abs >= 10n * one) return sign + scaledText(roundScaled(abs, decimals, 2), 2)
  if (abs >= one) return sign + scaledText(roundScaled(abs, decimals, 6), 6)
  return sign + formatUnits(abs, decimals)
}

/**
 * Amounts in a transaction's action line, short as Etherscan writes them there ("Approve 1.00 B ORIGO"): from 1 M
 * "1.49 M" / "1.00 B" (two decimals kept); from 1 up to four decimals; below 1 the list rounding (nine decimals,
 * tiny values in subscript form). The page puts the exact amount in the tooltip.
 */
export function actionAmount(raw: bigint, decimals: number): string {
  const abs = raw < 0n ? -raw : raw
  const sign = raw < 0n ? '-' : ''
  const one = 10n ** BigInt(decimals)
  for (const [exp, suffix] of COMPACT) {
    if (abs >= 10n ** BigInt(exp) * one) return `${sign}${scaledText(roundScaled(abs, decimals + exp, 2), 2, true)} ${suffix}`
  }
  if (abs >= one) return sign + scaledText(roundScaled(abs, decimals, 4), 4)
  return sign + listCoin(abs, decimals)
}

/** "2026-10-31 22:51:23", the Date Time (UTC) column and the Age tooltip. */
export function listDate(ts: string | number | Date): string {
  return new Date(ts).toISOString().slice(0, 19).replace('T', ' ')
}

/** "0.0123 HYPE" (exact). */
export const coin = (wei: string | bigint, maxFraction?: number) => `${formatUnits(wei, 18, { maxFraction })} ${COIN}`

/** Gas price in Gwei, exact. */
export const gwei = (wei: string | bigint) => `${formatUnits(wei, 9)} Gwei`

export function num(n: number | string | bigint): string {
  const s = typeof n === 'string' ? n : n.toString()
  const [i, f] = s.split('.')
  return group(i ?? '') + (f ? '.' + f : '')
}

/** "1 transaction", "276 transactions": a grouped count and its noun, singular only for exactly one. */
export const counted = (n: number, noun: string) => `${num(n)} ${noun}${n === 1 ? '' : 's'}`

/** USD value of a wei amount at `rate` dollars per coin. Float is fine here: it is an estimate shown next to the exact amount. */
export function usdOf(wei: string | bigint, rate: string | number | null): string | null {
  if (rate === null) return null
  const coins = Number(typeof wei === 'bigint' ? wei : BigInt(wei)) / 1e18
  return usd(coins * Number(rate))
}

export function usd(v: number): string {
  if (v === 0) return '$0.00'
  if (Math.abs(v) < 0.01) return '< $0.01'
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function pct(v: number, digits = 2): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`
}

/** "0xf4fea385aa..." */
export function trunc(s: string, keep = 12): string {
  return s.length > keep ? s.slice(0, keep) + '...' : s
}

/** "0xd8dA6BF2...7aA96045" */
export function mid(s: string, head = 10, tail = 8): string {
  return s.length > head + tail + 3 ? `${s.slice(0, head)}...${s.slice(-tail)}` : s
}

const unit = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Etherscan-style age: "10 secs ago", "1 min ago", "42 hrs ago", "4 days ago", "10 yrs 328 days ago". */
export function age(ts: string | number | Date, now: number = Date.now()): string {
  const t = ts instanceof Date ? ts.getTime() : typeof ts === 'number' ? ts : Date.parse(ts)
  const s = Math.max(0, Math.floor((now - t) / 1000))
  if (s < 60) return `${unit(s, 'sec', 'secs')} ago`
  if (s < 3600) return `${unit(Math.floor(s / 60), 'min', 'mins')} ago`
  if (s < 2 * 86400) return `${unit(Math.floor(s / 3600), 'hr', 'hrs')} ago`
  const days = Math.floor(s / 86400)
  if (days < 365) return `${unit(days, 'day', 'days')} ago`
  const yrs = Math.floor(days / 365)
  const rest = days - yrs * 365
  return `${unit(yrs, 'yr', 'yrs')}${rest ? ' ' + unit(rest, 'day', 'days') : ''} ago`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const p2 = (n: number) => String(n).padStart(2, '0')

/** "Aug-07-2015 03:30:33 AM UTC" */
export function utc(ts: string | number | Date): string {
  const d = new Date(ts)
  const h = d.getUTCHours()
  return `${MONTHS[d.getUTCMonth()]}-${p2(d.getUTCDate())}-${d.getUTCFullYear()} ${p2(h % 12 || 12)}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} ${h < 12 ? 'AM' : 'PM'} UTC`
}

export const isAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s)
export const isTxHash = (s: string) => /^0x[0-9a-fA-F]{64}$/.test(s)
export const isBlockNumber = (s: string) => /^\d+$/.test(s)
