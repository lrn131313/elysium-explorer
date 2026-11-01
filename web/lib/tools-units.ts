// The Unit Converter's arithmetic. Every unit is a power of ten of wei, so converting only moves the decimal point:
// exact for any length of input, no floating point and no rounding. Pure and import-free, so the browser and a plain
// `node --experimental-strip-types` test can both load it.

/** Etherscan's ladder up to the coin, with "Ether" read as HYPE (18 decimals on Elysium). `exp` is the power of ten in wei. */
export const UNITS = [
  { key: 'wei', label: 'Wei', exp: 0 },
  { key: 'kwei', label: 'KWei', exp: 3 },
  { key: 'mwei', label: 'MWei', exp: 6 },
  { key: 'gwei', label: 'GWei', exp: 9 },
  { key: 'szabo', label: 'Szabo', exp: 12 },
  { key: 'finney', label: 'Finney', exp: 15 },
  { key: 'hype', label: 'HYPE', exp: 18 },
] as const

export type UnitKey = (typeof UNITS)[number]['key']

/** A non-negative decimal as an integer and the count of its fractional digits: "12.50" is 1250 × 10^-2. */
export interface Decimal {
  digits: bigint
  scale: number
}

/** Plain decimals only ("1", "0.5", ".5", "5."), no sign, exponent or separators; null for anything else. */
export function parseDecimal(text: string): Decimal | null {
  if (!/^\d*\.?\d*$/.test(text) || !/\d/.test(text)) return null
  const dot = text.indexOf('.')
  const frac = dot < 0 ? '' : text.slice(dot + 1)
  return { digits: BigInt(text.replace('.', '')), scale: frac.length }
}

/** `d` × 10^`by` written out in full: "1000" or "0.000123", trailing fractional zeros dropped. */
export function shift(d: Decimal, by: number): string {
  const k = by - d.scale
  if (k >= 0) return (d.digits * 10n ** BigInt(k)).toString()
  const div = 10n ** BigInt(-k)
  const int = (d.digits / div).toString()
  const frac = (d.digits % div).toString().padStart(-k, '0').replace(/0+$/, '')
  return frac === '' ? int : `${int}.${frac}`
}

/** The amount `d`, counted in unit `from`, written in every unit. */
export function amounts(from: UnitKey, d: Decimal): Record<UnitKey, string> {
  const source = UNITS.find((u) => u.key === from)
  if (source === undefined) throw new Error(`unknown unit ${from}`)
  const out = {} as Record<UnitKey, string>
  for (const u of UNITS) out[u.key] = shift(d, source.exp - u.exp)
  return out
}

/** The same amount in every unit, from `text` typed in unit `from` (kept as typed there); null when `text` is no plain decimal. */
export function convertAll(from: UnitKey, text: string): Record<UnitKey, string> | null {
  const d = parseDecimal(text)
  return d === null ? null : { ...amounts(from, d), [from]: text }
}
