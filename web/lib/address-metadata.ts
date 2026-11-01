// The Solidity metadata hash at the end of a contract's deployed bytecode: Etherscan's "Swarm Source" line on the
// Contract tab ("ipfs://Qm…" or "bzzr://…"). Pure, dependency-free.
//
// solc appends a CBOR map ({ ipfs | bzzr0 | bzzr1: bytes, solc: bytes, experimental?: bool }) and then the map's
// length as two big-endian bytes. Code compiled with `bytecodeHash: none`, Vyper (an array, not a map) and plain
// hand-written code end otherwise; for them there is no source hash and the answer is null.

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58(bytes: Uint8Array): string {
  let n = 0n
  for (const b of bytes) n = n * 256n + BigInt(b)
  let out = ''
  while (n > 0n) {
    out = B58.charAt(Number(n % 58n)) + out
    n /= 58n
  }
  for (const b of bytes) {
    if (b !== 0) break
    out = `1${out}`
  }
  return out
}

const hexOf = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')

function bytesOf(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** A CBOR item's major type and length argument at `at`, in the short forms solc writes; null for any other form. */
function head(b: Uint8Array, at: number): { major: number; value: number; next: number } | null {
  const first = b[at]
  if (first === undefined) return null
  const major = first >> 5
  const info = first & 0x1f
  if (info < 24) return { major, value: info, next: at + 1 }
  if (info === 24) {
    const v = b[at + 1]
    return v === undefined ? null : { major, value: v, next: at + 2 }
  }
  if (info === 25) {
    const hi = b[at + 1]
    const lo = b[at + 2]
    return hi === undefined || lo === undefined ? null : { major, value: hi * 256 + lo, next: at + 3 }
  }
  return null
}

/** The metadata map: text keys to byte strings or booleans. Null unless `b` is exactly one such map. */
function metadataMap(b: Uint8Array): Map<string, Uint8Array | boolean> | null {
  const map = head(b, 0)
  if (map === null || map.major !== 5) return null
  const out = new Map<string, Uint8Array | boolean>()
  let at = map.next
  for (let k = 0; k < map.value; k++) {
    const key = head(b, at)
    if (key === null || key.major !== 3 || key.next + key.value > b.length) return null
    const name = new TextDecoder().decode(b.subarray(key.next, key.next + key.value))
    at = key.next + key.value
    const first = b[at]
    if (first === 0xf4 || first === 0xf5) {
      out.set(name, first === 0xf5)
      at += 1
      continue
    }
    const value = head(b, at)
    if (value === null || value.major !== 2 || value.next + value.value > b.length) return null
    out.set(name, b.subarray(value.next, value.next + value.value))
    at = value.next + value.value
  }
  return at === b.length ? out : null
}

/** "ipfs://Qm…" or "bzzr://…" from the metadata solc appended to `bytecode`; null when it carries none. */
export function swarmSource(bytecode: string): string | null {
  const hex = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode
  if (hex.length < 4 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null
  const len = parseInt(hex.slice(-4), 16)
  if (len === 0 || len * 2 + 4 > hex.length) return null
  const fields = metadataMap(bytesOf(hex.slice(-(len * 2 + 4), -4)))
  if (fields === null) return null
  const ipfs = fields.get('ipfs')
  // A sha2-256 multihash: 0x12, length 0x20, then the 32-byte digest; base58 of it is the familiar "Qm…" CID.
  if (ipfs instanceof Uint8Array && ipfs.length === 34 && ipfs[0] === 0x12 && ipfs[1] === 0x20) return `ipfs://${base58(ipfs)}`
  for (const key of ['bzzr1', 'bzzr0']) {
    const swarm = fields.get(key)
    if (swarm instanceof Uint8Array && swarm.length === 32) return `bzzr://${hexOf(swarm)}`
  }
  return null
}
