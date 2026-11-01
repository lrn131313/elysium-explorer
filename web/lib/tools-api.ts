// Server-side data for the developer tools (route handlers and server components only: it reads server env vars).
import { api, rpcBatch } from './api'

// ---------- Input Data Decoder ----------

/**
 * Full function signatures for a 4-byte selector, from the Sourcify signature database (the one lib/methods.ts asks,
 * which keeps only the names). Same trust rule: only signatures seen in a verified contract and not flagged as spam,
 * because anyone can add a signature and 4-byte collisions are cheap to make. Found signatures are kept for the life
 * of the process; a selector the database does not know is asked again after an hour. Both caches are capped so
 * arbitrary selectors sent to the decoder cannot grow them without bound.
 */
const LOOKUP_URL = 'https://api.4byte.sourcify.dev/signature-database/v1/lookup'
const UNKNOWN_RETRY_MS = 3_600_000
const CACHE_MAX = 5_000
export const SELECTOR = /^0x[0-9a-f]{8}$/

interface Candidate {
  name: string // full signature, e.g. approve(address,uint256)
  filtered: boolean
  hasVerifiedContract: boolean
}

const signaturesBySelector = new Map<string, string[]>()
const unknownAt = new Map<string, number>()

function remember<V>(map: Map<string, V>, key: string, value: V): void {
  if (map.size >= CACHE_MAX) {
    const oldest = map.keys().next()
    if (!oldest.done) map.delete(oldest.value)
  }
  map.set(key, value)
}

/** Signatures for `selector` (lower-case "0x" + 8 hex); empty when the database knows none it trusts. */
export async function functionSignatures(selector: string): Promise<string[]> {
  if (!SELECTOR.test(selector)) throw new Error(`not a selector: ${selector}`)
  const hit = signaturesBySelector.get(selector)
  if (hit !== undefined) return hit
  const at = unknownAt.get(selector)
  if (at !== undefined && Date.now() - at < UNKNOWN_RETRY_MS) return []
  const res = await fetch(`${LOOKUP_URL}?function=${selector}`, { signal: AbortSignal.timeout(5_000), cache: 'no-store' })
  if (!res.ok) throw new Error(`signature database answered HTTP ${res.status}`)
  const body = (await res.json()) as { ok: boolean; result: { function: Record<string, Candidate[] | null> } }
  if (!body.ok) throw new Error('signature database answered ok=false')
  const candidates = body.result.function[selector]
  const trusted = candidates ? candidates.filter((c) => c.hasVerifiedContract && !c.filtered).map((c) => c.name) : []
  if (trusted.length > 0) remember(signaturesBySelector, selector, trusted)
  else remember(unknownAt, selector, Date.now())
  return trusted
}

/** The verified ABI of a contract, or null when the address is not a contract verified on this explorer. */
export async function verifiedAbi(address: string): Promise<unknown[] | null> {
  const info = await api.address(address)
  if (!info.is_contract || info.is_verified !== true) return null
  const c = await api.contract(address)
  return c.is_verified === true && Array.isArray(c.abi) ? c.abi : null
}

/** A transaction's input data and target, with the target's verified ABI when there is one. */
export async function txCall(hash: string): Promise<{ input: string; to: string | null; abi: unknown[] | null }> {
  const tx = await api.tx(hash)
  if (tx.to === null) return { input: tx.raw_input, to: null, abi: null }
  return { input: tx.raw_input, to: tx.to.hash, abi: tx.to.is_verified === true ? await verifiedAbi(tx.to.hash) : null }
}

// ---------- Account Balance Checker ----------

/**
 * Blockscout's Etherscan-style API beside v2 (BLOCKSCOUT_API_URL ".../api/v2" → ".../api"). lib/api.ts has the same
 * rule in legacy(), which only reads list answers; getblocknobytime answers one object, so it is read here.
 */
function legacyUrl(params: Record<string, string>): URL {
  const v2 = process.env.BLOCKSCOUT_API_URL
  if (!v2) throw new Error('BLOCKSCOUT_API_URL is not set (see web/.env.local)')
  if (!v2.endsWith('/v2')) throw new Error(`BLOCKSCOUT_API_URL must end in /api/v2, got ${v2}`)
  const url = new URL(v2.slice(0, -'/v2'.length))
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url
}

/** The last block mined at or before `unix` (seconds). */
export async function blockAtOrBefore(unix: number): Promise<number> {
  const url = legacyUrl({ module: 'block', action: 'getblocknobytime', timestamp: String(unix), closest: 'before' })
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Blockscout legacy API ${res.status} on block.getblocknobytime`)
  const body = (await res.json()) as { status: string; message: string; result: { blockNumber: string } | null }
  if (body.status !== '1' || body.result === null) throw new Error(`Blockscout legacy API block.getblocknobytime: ${body.message}`)
  return Number(body.result.blockNumber)
}

const hexQuantity = (n: number) => `0x${n.toString(16)}`

/** One node reply that must be a hex string ("0x…"); anything else is a node fault. */
function hexResult(r: { result: unknown } | { error: string }, what: string): string {
  if ('error' in r) throw new Error(`node RPC ${what}: ${r.error}`)
  if (typeof r.result !== 'string' || !/^0x[0-9a-fA-F]*$/.test(r.result)) throw new Error(`node RPC ${what}: unexpected result ${JSON.stringify(r.result)}`)
  return r.result
}

export interface BlockHead {
  number: number
  timestamp: number // Unix seconds
}

/** Number and time of a block, or null when the node has no such block yet. */
export async function blockHead(block: number | 'latest'): Promise<BlockHead | null> {
  const [r] = await rpcBatch([{ method: 'eth_getBlockByNumber', params: [block === 'latest' ? 'latest' : hexQuantity(block), false] }])
  if (r === undefined) throw new Error('node RPC eth_getBlockByNumber: empty batch reply')
  if ('error' in r) throw new Error(`node RPC eth_getBlockByNumber: ${r.error}`)
  if (r.result === null) return null
  const b = r.result as { number: string; timestamp: string }
  return { number: Number.parseInt(b.number, 16), timestamp: Number.parseInt(b.timestamp, 16) }
}

/** The address's coin balance (wei) at the end of `block`; the node is an archive node, so any past block answers. */
export async function coinBalanceAt(address: string, block: number): Promise<bigint> {
  const [r] = await rpcBatch([{ method: 'eth_getBalance', params: [address, hexQuantity(block)] }])
  if (r === undefined) throw new Error('node RPC eth_getBalance: empty batch reply')
  return BigInt(hexResult(r, 'eth_getBalance'))
}

/**
 * `balanceOf(account)` of an ERC-20 at the end of `block`. A contract that did not exist yet at that block, or a call
 * that reverts, is the user's to know about, so it comes back as `{ problem }` with the node's own words.
 */
export async function tokenBalanceAt(token: string, account: string, block: number): Promise<{ raw: bigint } | { problem: string }> {
  const data = `0x70a08231${account.slice(2).toLowerCase().padStart(64, '0')}`
  const tag = hexQuantity(block)
  const [code, call] = await rpcBatch([
    { method: 'eth_getCode', params: [token, tag] },
    { method: 'eth_call', params: [{ to: token, data }, tag] },
  ])
  if (code === undefined || call === undefined) throw new Error('node RPC: short batch reply')
  if (hexResult(code, 'eth_getCode') === '0x') return { problem: `The token contract did not exist yet at block ${block}.` }
  if ('error' in call) return { problem: `The token's balanceOf call failed at block ${block}: ${call.error}` }
  const out = hexResult(call, 'eth_call')
  if (out.length !== 66) return { problem: `The token's balanceOf answered ${out.length === 2 ? 'nothing' : `${(out.length - 2) / 2} bytes`} instead of one number.` }
  return { raw: BigInt(out) }
}
