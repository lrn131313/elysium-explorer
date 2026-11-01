// Solidity ABI decoding for the Input Data Decoder: keccak256, type parsing (from a JSON ABI or a signature such as
// "transfer(address,uint256)"), and a strict decoder for call data. Pure and import-free, so the browser, the server
// and a plain `node --experimental-strip-types` test (lib/tools-abi.test.mjs) all load the same code.
//
// Strict means data that a Solidity contract would reject is refused: an address with non-zero padding, a bool other
// than 0 or 1, an integer outside its type's range, bytesN with non-zero padding, offsets or lengths past the end of the
// data. That matters when the function is guessed from its 4-byte selector: a wrong guess almost never decodes cleanly.

/** Input the user can correct (bad hex, bad ABI, data that does not fit the function). The message is shown as is. */
export class AbiError extends Error {}

// ---------- keccak256 (Keccak-f[1600], the pre-SHA-3 padding Ethereum uses) ----------

const MASK64 = (1n << 64n) - 1n
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
  0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
  0x000000000000800an, 0x800000008000000an, 0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
]
// Rotation offsets, indexed x + 5y.
const ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14]

const rotl = (v: bigint, n: number): bigint => (n === 0 ? v : ((v << BigInt(n)) | (v >> BigInt(64 - n))) & MASK64)

function lane(a: bigint[], i: number): bigint {
  const v = a[i]
  if (v === undefined) throw new Error(`keccak: no lane ${i}`)
  return v
}

function keccakF(a: bigint[]): void {
  const b: bigint[] = new Array<bigint>(25).fill(0n)
  const c: bigint[] = new Array<bigint>(5).fill(0n)
  for (let round = 0; round < 24; round++) {
    for (let x = 0; x < 5; x++) c[x] = lane(a, x) ^ lane(a, x + 5) ^ lane(a, x + 10) ^ lane(a, x + 15) ^ lane(a, x + 20)
    for (let x = 0; x < 5; x++) {
      const d = lane(c, (x + 4) % 5) ^ rotl(lane(c, (x + 1) % 5), 1)
      for (let y = 0; y < 25; y += 5) a[x + y] = lane(a, x + y) ^ d
    }
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++) {
        const r = ROT[x + 5 * y]
        if (r === undefined) throw new Error('keccak: rotation table')
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(lane(a, x + 5 * y), r)
      }
    for (let y = 0; y < 25; y += 5)
      for (let x = 0; x < 5; x++) a[x + y] = lane(b, x + y) ^ (~lane(b, ((x + 1) % 5) + y) & MASK64 & lane(b, ((x + 2) % 5) + y))
    const rc = RC[round]
    if (rc === undefined) throw new Error('keccak: round constants')
    a[0] = lane(a, 0) ^ rc
  }
}

const RATE = 136 // bytes, for a 256-bit output

/** Ethereum's keccak256 of `data`. */
export function keccak256(data: Uint8Array): Uint8Array {
  // Pad: a 0x01 after the data, 0x80 on the block's last byte (one byte 0x81 when they meet).
  const blocks = Math.floor(data.length / RATE) + 1
  const padded = new Uint8Array(blocks * RATE)
  padded.set(data)
  const last = padded.length - 1
  padded[data.length] = 0x01
  padded[last] = data.length === last ? 0x81 : 0x80
  const view = new DataView(padded.buffer)
  const state: bigint[] = new Array<bigint>(25).fill(0n)
  for (let off = 0; off < padded.length; off += RATE) {
    for (let i = 0; i < RATE / 8; i++) state[i] = lane(state, i) ^ view.getBigUint64(off + i * 8, true)
    keccakF(state)
  }
  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  for (let i = 0; i < 4; i++) outView.setBigUint64(i * 8, lane(state, i), true)
  return out
}

// ---------- hex helpers ----------

export const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')

/** "0x…" or bare hex to bytes; whitespace (pasted line breaks) is ignored. */
export function hexToBytes(text: string, what: string): Uint8Array {
  const compact = text.replace(/\s+/g, '')
  const hex = /^0x/i.test(compact) ? compact.slice(2) : compact
  if (!/^[0-9a-fA-F]*$/.test(hex)) throw new AbiError(`The ${what} must be hexadecimal: the characters 0-9 and a-f, after an optional 0x.`)
  if (hex.length % 2 !== 0) throw new AbiError(`The ${what} has an odd number of hex characters; every byte takes two.`)
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** EIP-55 mixed-case address from 40 hex characters. */
export function toChecksumAddress(hex40: string): string {
  const lower = hex40.toLowerCase()
  const hash = toHex(keccak256(new TextEncoder().encode(lower)))
  let out = '0x'
  for (let i = 0; i < 40; i++) {
    const ch = lower.charAt(i)
    out += Number.parseInt(hash.charAt(i), 16) >= 8 ? ch.toUpperCase() : ch
  }
  return out
}

// ---------- types ----------

export type AbiType =
  | { kind: 'uint' | 'int'; bits: number }
  | { kind: 'address' }
  | { kind: 'bool' }
  | { kind: 'fixedbytes'; size: number } // bytes1 … bytes32; also `function` (bytes24)
  | { kind: 'bytes' }
  | { kind: 'string' }
  | { kind: 'array'; of: AbiType } // T[]
  | { kind: 'fixedarray'; of: AbiType; length: number } // T[k]
  | { kind: 'tuple'; components: { name: string; type: AbiType }[] }

/** The type as it appears in a canonical signature: uint256, (address,uint256)[], bytes32[2]. */
export function canonical(t: AbiType): string {
  switch (t.kind) {
    case 'uint':
    case 'int':
      return `${t.kind}${t.bits}`
    case 'address':
    case 'bool':
    case 'bytes':
    case 'string':
      return t.kind
    case 'fixedbytes':
      return `bytes${t.size}`
    case 'array':
      return `${canonical(t.of)}[]`
    case 'fixedarray':
      return `${canonical(t.of)}[${t.length}]`
    case 'tuple':
      return `(${t.components.map((c) => canonical(c.type)).join(',')})`
  }
}

/** An elementary type name (no tuple, no array suffix). */
function elementary(name: string): AbiType {
  if (name === 'address' || name === 'bool' || name === 'bytes' || name === 'string') return { kind: name }
  if (name === 'function') return { kind: 'fixedbytes', size: 24 }
  const int = /^(u?int)(\d*)$/.exec(name)
  if (int !== null) {
    const bits = int[2] === '' ? 256 : Number(int[2])
    if (bits < 8 || bits > 256 || bits % 8 !== 0) throw new AbiError(`Unknown type ${name}: integer sizes run from 8 to 256 in steps of 8.`)
    return { kind: int[1] === 'uint' ? 'uint' : 'int', bits }
  }
  const fixed = /^bytes(\d+)$/.exec(name)
  if (fixed !== null) {
    const size = Number(fixed[1])
    if (size < 1 || size > 32) throw new AbiError(`Unknown type ${name}: bytesN runs from bytes1 to bytes32.`)
    return { kind: 'fixedbytes', size }
  }
  if (/^u?fixed/.test(name)) throw new AbiError(`The type ${name} (fixed-point) is not supported.`)
  throw new AbiError(`Unknown type ${name}.`)
}

/** Peels "[2][]" off the end of a type: the array dimensions, innermost first (null for []). */
function splitArrays(type: string): { base: string; dims: (number | null)[] } {
  const dims: (number | null)[] = []
  let base = type
  while (base.endsWith(']')) {
    const open = base.lastIndexOf('[')
    const len = base.slice(open + 1, -1)
    if (open < 0 || !/^\d*$/.test(len)) throw new AbiError(`Malformed array type ${type}.`)
    if (len !== '' && Number(len) < 1) throw new AbiError(`Fixed-size arrays need at least one element: ${type}.`)
    dims.unshift(len === '' ? null : Number(len))
    base = base.slice(0, open)
  }
  return { base, dims }
}

const wrapArrays = (t: AbiType, dims: (number | null)[]): AbiType =>
  dims.reduce<AbiType>((of, length) => (length === null ? { kind: 'array', of } : { kind: 'fixedarray', of, length }), t)

/** Splits "a,(b,c)[],d" at the commas outside parentheses. */
function splitTopLevel(list: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < list.length; i++) {
    const ch = list.charAt(i)
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      parts.push(list.slice(start, i))
      start = i + 1
    }
    if (depth < 0) throw new AbiError(`Unbalanced parentheses in (${list}).`)
  }
  if (depth !== 0) throw new AbiError(`Unbalanced parentheses in (${list}).`)
  parts.push(list.slice(start))
  return parts
}

/** One type from a signature: "uint256", "(address,uint256)[]", "tuple(address,uint256)". */
export function parseSignatureType(text: string): AbiType {
  const { base, dims } = splitArrays(text.trim())
  if ((base.startsWith('(') || base.startsWith('tuple(')) && base.endsWith(')')) {
    const inner = base.slice(base.indexOf('(') + 1, -1)
    const components = inner.trim() === '' ? [] : splitTopLevel(inner).map((c) => ({ name: '', type: parseSignatureType(c) }))
    return wrapArrays({ kind: 'tuple', components }, dims)
  }
  return wrapArrays(elementary(base), dims)
}

/** A function as the decoder needs it: its name and its inputs, each with a (possibly empty) name and a type. */
export interface AbiFunction {
  name: string
  inputs: { name: string; type: AbiType }[]
}

/** "transfer(address,uint256)" → the function; parameter names are unknown, so empty. */
export function parseSignature(signature: string): AbiFunction {
  const s = signature.trim()
  const open = s.indexOf('(')
  const name = s.slice(0, open).trim()
  if (open < 0 || !s.endsWith(')') || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) throw new AbiError(`Not a function signature: ${signature}`)
  const list = s.slice(open + 1, -1)
  const inputs = list.trim() === '' ? [] : splitTopLevel(list).map((p) => ({ name: '', type: parseSignatureType(p) }))
  return { name, inputs }
}

export const signatureOf = (f: AbiFunction): string => `${f.name}(${f.inputs.map((i) => canonical(i.type)).join(',')})`

/** The 4-byte selector, "0xa9059cbb", of a function. */
export const selectorOf = (f: AbiFunction): string => `0x${toHex(keccak256(new TextEncoder().encode(signatureOf(f))).subarray(0, 4))}`

// ---------- JSON ABI ----------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** One input of a JSON ABI entry: {"name": "to", "type": "address"}, tuples with "components". */
function jsonParam(v: unknown, where: string): { name: string; type: AbiType } {
  if (!isObject(v) || typeof v.type !== 'string') throw new AbiError(`${where}: each parameter needs a "type".`)
  const name = typeof v.name === 'string' ? v.name : ''
  const { base, dims } = splitArrays(v.type.trim())
  if (base === 'tuple') {
    if (!Array.isArray(v.components)) throw new AbiError(`${where}: the tuple parameter ${name} has no "components".`)
    const components = v.components.map((c, i) => jsonParam(c, `${where}, ${name} component ${i + 1}`))
    return { name, type: wrapArrays({ kind: 'tuple', components }, dims) }
  }
  return { name, type: wrapArrays(elementary(base), dims) }
}

/** The functions of a pasted ABI (see abiFunctions). */
export function parseAbiJson(text: string): AbiFunction[] {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (e) {
    // JSON.parse reports bad input only as a SyntaxError; turn it into a message for the form.
    if (e instanceof SyntaxError) throw new AbiError(`The ABI is not valid JSON: ${e.message}`)
    throw e
  }
  return abiFunctions(json)
}

/**
 * The functions of an ABI: a JSON array of entries (as solc writes it), a compiler artifact holding one under "abi", or
 * a single function entry. Events, errors and the constructor are skipped.
 */
export function abiFunctions(json: unknown): AbiFunction[] {
  const entries: unknown[] = Array.isArray(json) ? json : isObject(json) && Array.isArray(json.abi) ? json.abi : isObject(json) ? [json] : []
  if (entries.length === 0) throw new AbiError('The ABI holds no entries. Paste the JSON array of the contract’s ABI.')
  const fns: AbiFunction[] = []
  for (const [i, e] of entries.entries()) {
    if (!isObject(e)) throw new AbiError(`ABI entry ${i + 1} is not an object.`)
    // A missing "type" means "function" in the ABI specification.
    if (e.type !== undefined && e.type !== 'function') continue
    if (typeof e.name !== 'string' || e.name === '') throw new AbiError(`ABI entry ${i + 1} is a function without a "name".`)
    const inputs = e.inputs === undefined ? [] : e.inputs
    if (!Array.isArray(inputs)) throw new AbiError(`ABI entry ${i + 1} (${e.name}): "inputs" is not a list.`)
    fns.push({ name: e.name, inputs: inputs.map((p, j) => jsonParam(p, `${e.name}, parameter ${j + 1}`)) })
  }
  if (fns.length === 0) throw new AbiError('The ABI has no functions.')
  return fns
}

// ---------- decoding ----------

export type AbiValue =
  | { kind: 'address'; value: string } // EIP-55 checksummed
  | { kind: 'bool'; value: boolean }
  | { kind: 'number'; value: bigint }
  | { kind: 'bytes'; value: string } // 0x hex
  | { kind: 'string'; value: string }
  | { kind: 'array'; items: AbiValue[] }
  | { kind: 'tuple'; items: AbiValue[] }

export function isDynamic(t: AbiType): boolean {
  switch (t.kind) {
    case 'bytes':
    case 'string':
      return true
    case 'array':
      return true
    case 'fixedarray':
      return isDynamic(t.of)
    case 'tuple':
      return t.components.some((c) => isDynamic(c.type))
    default:
      return false
  }
}

/** Bytes a type takes in the head of its enclosing tuple: 32 for anything dynamic. */
function headSize(t: AbiType): number {
  if (isDynamic(t)) return 32
  if (t.kind === 'tuple') return t.components.reduce((n, c) => n + headSize(c.type), 0)
  if (t.kind === 'fixedarray') return t.length * headSize(t.of)
  return 32
}

class Data {
  readonly bytes: Uint8Array

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
  }

  word(pos: number): Uint8Array {
    if (pos < 0 || pos + 32 > this.bytes.length) throw new AbiError(`The data ends too early: a 32-byte word at byte ${pos} is past its end (${this.bytes.length} bytes).`)
    return this.bytes.subarray(pos, pos + 32)
  }

  uint(pos: number): bigint {
    return BigInt(`0x${toHex(this.word(pos))}`)
  }

  /** An offset or a length: a word that must point inside the data. */
  size(pos: number, what: string): number {
    const v = this.uint(pos)
    if (v > BigInt(this.bytes.length)) throw new AbiError(`The ${what} at byte ${pos} (${v}) is larger than the data (${this.bytes.length} bytes).`)
    return Number(v)
  }
}

const allZero = (b: Uint8Array) => b.every((x) => x === 0)

function decodeList(types: AbiType[], d: Data, start: number): AbiValue[] {
  let head = start
  return types.map((t) => {
    const at = head
    head += headSize(t)
    return isDynamic(t) ? decodeAt(t, d, start + d.size(at, 'offset')) : decodeAt(t, d, at)
  })
}

/** `length` elements of type `of`, laid out like a tuple from `start`. */
function decodeArray(of: AbiType, length: number, d: Data, start: number): AbiValue {
  // Every element takes at least 32 bytes of head, so a length the data cannot hold is refused before decoding.
  if (start + length * 32 > d.bytes.length) throw new AbiError(`The array at byte ${start} (${length} elements) runs past the end of the data.`)
  return { kind: 'array', items: decodeList(new Array<AbiType>(length).fill(of), d, start) }
}

function decodeAt(t: AbiType, d: Data, pos: number): AbiValue {
  switch (t.kind) {
    case 'uint': {
      const v = d.uint(pos)
      if (v >> BigInt(t.bits) !== 0n) throw new AbiError(`The value at byte ${pos} does not fit in uint${t.bits}.`)
      return { kind: 'number', value: v }
    }
    case 'int': {
      const raw = d.uint(pos)
      const v = raw >= 1n << 255n ? raw - (1n << 256n) : raw
      const half = 1n << BigInt(t.bits - 1)
      if (v < -half || v >= half) throw new AbiError(`The value at byte ${pos} does not fit in int${t.bits}.`)
      return { kind: 'number', value: v }
    }
    case 'address': {
      const w = d.word(pos)
      if (!allZero(w.subarray(0, 12))) throw new AbiError(`The word at byte ${pos} is not an address: its first 12 bytes are not zero.`)
      return { kind: 'address', value: toChecksumAddress(toHex(w.subarray(12))) }
    }
    case 'bool': {
      const v = d.uint(pos)
      if (v > 1n) throw new AbiError(`The word at byte ${pos} is not a bool (0 or 1).`)
      return { kind: 'bool', value: v === 1n }
    }
    case 'fixedbytes': {
      const w = d.word(pos)
      if (!allZero(w.subarray(t.size))) throw new AbiError(`The word at byte ${pos} is not a bytes${t.size}: the bytes after the first ${t.size} are not zero.`)
      return { kind: 'bytes', value: `0x${toHex(w.subarray(0, t.size))}` }
    }
    case 'bytes':
    case 'string': {
      const len = d.size(pos, 'length')
      const end = pos + 32 + len
      const padded = pos + 32 + Math.ceil(len / 32) * 32
      if (padded > d.bytes.length) throw new AbiError(`The ${t.kind} at byte ${pos} (${len} bytes) runs past the end of the data.`)
      if (!allZero(d.bytes.subarray(end, padded))) throw new AbiError(`The ${t.kind} at byte ${pos} has non-zero padding.`)
      const body = d.bytes.subarray(pos + 32, end)
      return t.kind === 'bytes' ? { kind: 'bytes', value: `0x${toHex(body)}` } : { kind: 'string', value: new TextDecoder().decode(body) }
    }
    case 'array':
      return decodeArray(t.of, d.size(pos, 'array length'), d, pos + 32)
    case 'fixedarray':
      return decodeArray(t.of, t.length, d, pos)
    case 'tuple':
      return { kind: 'tuple', items: decodeList(t.components.map((c) => c.type), d, pos) }
  }
}

export interface DecodedCall {
  name: string
  signature: string // canonical, e.g. transfer(address,uint256)
  selector: string // 0xa9059cbb
  params: { name: string; type: AbiType; value: AbiValue }[]
}

/** The input data's selector, "0x" and 8 hex characters. */
export function selectorOfData(input: Uint8Array): string {
  if (input.length < 4) throw new AbiError('The input data is shorter than a 4-byte function selector.')
  return `0x${toHex(input.subarray(0, 4))}`
}

/** Decodes call data (selector + arguments) as a call of `f`; the selector must be `f`'s. */
export function decodeCall(f: AbiFunction, input: Uint8Array): DecodedCall {
  const selector = selectorOf(f)
  if (selectorOfData(input) !== selector) throw new AbiError(`The input data's selector ${selectorOfData(input)} is not ${signatureOf(f)} (${selector}).`)
  const values = decodeList(
    f.inputs.map((i) => i.type),
    new Data(input.subarray(4)),
    0,
  )
  return {
    name: f.name,
    signature: signatureOf(f),
    selector,
    params: f.inputs.map((p, i) => {
      const value = values[i]
      if (value === undefined) throw new Error(`decoder returned ${values.length} values for ${f.inputs.length} inputs`)
      return { name: p.name, type: p.type, value }
    }),
  }
}

/** The ABI's function whose selector starts the input data; an AbiError naming the selector when none does. */
export function findFunction(fns: AbiFunction[], input: Uint8Array): AbiFunction {
  const sel = selectorOfData(input)
  const f = fns.find((x) => selectorOf(x) === sel)
  if (f === undefined) throw new AbiError(`No function in this ABI has the selector ${sel}.`)
  return f
}

// ---------- display ----------

/**
 * A value as text: numbers in decimal, addresses checksummed, bytes in hex. Top-level strings are shown as they are;
 * inside arrays and tuples they are quoted, and arrays read [a, b], tuples (a, b).
 */
export function formatValue(v: AbiValue, nested = false): string {
  switch (v.kind) {
    case 'address':
    case 'bytes':
      return v.value
    case 'bool':
      return v.value ? 'true' : 'false'
    case 'number':
      return v.value.toString()
    case 'string':
      return nested ? JSON.stringify(v.value) : v.value
    case 'array':
      return `[${v.items.map((x) => formatValue(x, true)).join(', ')}]`
    case 'tuple':
      return `(${v.items.map((x) => formatValue(x, true)).join(', ')})`
  }
}

/** "transfer(address to, uint256 amount)", the way Etherscan heads a decoded call. */
export const describeCall = (c: DecodedCall): string =>
  `${c.name}(${c.params.map((p) => (p.name === '' ? canonical(p.type) : `${canonical(p.type)} ${p.name}`)).join(', ')})`
