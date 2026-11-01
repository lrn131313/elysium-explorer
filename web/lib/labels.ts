// Name tags for addresses (Etherscan's "Uniswap V3: Router" style), server-side only.
//
// Two sources:
//   1. data/labels.json: hand-curated contracts (launchpads, factories, routers, WHYPEs), each confirmed on-chain.
//   2. Pools: every PoolCreated log of each curated 'v3-factory', read from our own node and named
//      "<Project>: <TOKEN>/<QUOTE> <fee>%". New pools are picked up incrementally, at most once a minute.
import curated from '@/data/labels.json'
import { rpcBatch } from './api'

export interface Label {
  name: string
  project: string
}

interface Entry extends Label {
  address: string
  kind?: string
}

const POOL_CREATED = '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118'
const SYMBOL = '0x95d89b41'
const REFRESH_MS = 60_000

const entries = curated.labels as Entry[]
const factories = entries.filter((e) => e.kind === 'v3-factory')
// Every WHYPE is a quote asset: a pool reads "TOKEN/WHYPE", whichever of the two sorts first as token0.
const quoteAssets = new Set(entries.filter((e) => e.name.endsWith(': WHYPE')).map((e) => e.address))

const map = new Map<string, Label>(entries.map((e) => [e.address, { name: e.name, project: e.project }]))
const symbols = new Map<string, string>()
let scannedTo = -1
let lastRefresh = 0
let inflight: Promise<void> | null = null

const word = (hex: string, i: number) => hex.slice(2 + i * 64, 2 + (i + 1) * 64)
const topicAddr = (t: string) => `0x${t.slice(26)}`.toLowerCase()

/** ABI `string` return, or the older `bytes32` symbol some tokens use. */
function decodeSymbol(hex: string): string | null {
  if (hex.length === 66) {
    const bytes = Buffer.from(hex.slice(2), 'hex')
    const s = bytes.toString('utf8').replace(/\0+$/, '')
    return s || null
  }
  if (hex.length < 130) return null
  const len = Number.parseInt(word(hex, 1), 16)
  const s = Buffer.from(hex.slice(130, 130 + len * 2), 'hex').toString('utf8')
  return s || null
}

async function loadSymbols(tokens: string[]): Promise<void> {
  const missing = [...new Set(tokens)].filter((t) => !symbols.has(t))
  const replies = await rpcBatch(missing.map((t) => ({ method: 'eth_call', params: [{ to: t, data: SYMBOL }, 'latest'] })))
  replies.forEach((r, i) => {
    const t = missing[i]
    if (t === undefined) return
    const sym = 'result' in r && typeof r.result === 'string' ? decodeSymbol(r.result) : null
    // A token without a readable symbol() still gets a name: its shortened address.
    symbols.set(t, sym ?? `${t.slice(0, 6)}…${t.slice(-4)}`)
  })
}

async function scanPools(): Promise<void> {
  const [head] = await rpcBatch([{ method: 'eth_blockNumber', params: [] }])
  if (!head || !('result' in head) || typeof head.result !== 'string') throw new Error(`eth_blockNumber: ${head && 'error' in head ? head.error : 'no result'}`)
  const to = Number.parseInt(head.result, 16)
  if (to <= scannedTo) return
  const from = scannedTo + 1
  const replies = await rpcBatch(
    factories.map((f) => ({
      method: 'eth_getLogs',
      params: [{ address: f.address, topics: [POOL_CREATED], fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` }],
    })),
    30_000,
  )
  const found: { pool: string; token0: string; token1: string; fee: number; project: string }[] = []
  replies.forEach((r, i) => {
    const f = factories[i]
    if (f === undefined) return
    if ('error' in r) throw new Error(`eth_getLogs ${f.name}: ${r.error}`)
    for (const log of r.result as { topics: string[]; data: string }[]) {
      const [, t0, t1, fee] = log.topics
      if (t0 === undefined || t1 === undefined || fee === undefined) continue
      found.push({ pool: `0x${word(log.data, 1).slice(24)}`.toLowerCase(), token0: topicAddr(t0), token1: topicAddr(t1), fee: Number.parseInt(fee, 16), project: f.project })
    }
  })
  await loadSymbols(found.flatMap((p) => [p.token0, p.token1]))
  for (const p of found) {
    if (map.has(p.pool)) continue
    const [base, quote] = quoteAssets.has(p.token0) && !quoteAssets.has(p.token1) ? [p.token1, p.token0] : [p.token0, p.token1]
    map.set(p.pool, { name: `${p.project}: ${symbols.get(base)}/${symbols.get(quote)} ${p.fee / 10_000}%`, project: p.project })
  }
  scannedTo = to
}

function refresh(): Promise<void> {
  inflight ??= scanPools()
    .catch((e: unknown) => {
      // The node being down or behind must not break pages: they keep the curated names and the pools found so far,
      // and the next request retries. The error is logged, not swallowed.
      console.error('labels: pool scan failed:', e)
    })
    .finally(() => {
      lastRefresh = Date.now()
      inflight = null
    })
  return inflight
}

/**
 * The current name tags. The first call waits for the first pool scan; later calls return at once and refresh
 * in the background when the last scan is over a minute old.
 */
export async function getLabels(): Promise<ReadonlyMap<string, Label>> {
  if (lastRefresh === 0) await refresh()
  else if (Date.now() - lastRefresh > REFRESH_MS) void refresh()
  return map
}
