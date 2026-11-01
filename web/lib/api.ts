// Server-side data access (server components and route handlers only: it reads server env vars).
import type {
  AddressCounters,
  AddressParam,
  AddressInfo,
  Block,
  ChartPoint,
  InternalTransaction,
  Log,
  Page,
  PageParams,
  SearchItem,
  SearchRedirect,
  SmartContract,
  Stats,
  TokenBalance,
  TokenInfo,
  TokenTransfer,
  Transaction,
} from './types'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set (see web/.env.local)`)
  return v
}

const API = () => requireEnv('BLOCKSCOUT_API_URL')
const RPC = () => requireEnv('NODE_RPC_URL')

/** Raised for a 404 from the API so pages can render their not-found state. */
export class NotFoundError extends Error {}

/**
 * Etherscan's internal-call lists (/txsInternal, an address's Internal tab) hold calls that moved value plus contract
 * creations and self-destructs. Blockscout's `include_zero_value=false` drops the zero-value calls but keeps
 * delegatecalls and staticcalls, which move no value of their own (a delegatecall only repeats its parent's value), and
 * it can filter by call type only within one block. So they are dropped here, and each page is topped up from the
 * following rows to `size`. The next page starts after the last row shown: its {block_number, transaction_index,
 * index} is exactly Blockscout's cursor for these lists.
 */
const NO_OWN_VALUE = new Set(['delegatecall', 'staticcall'])
const MAX_CHUNKS = 5

async function etherscanInternal(
  fetchPage: (p: PageParams) => Promise<Page<InternalTransaction>>,
  size: number,
  start: PageParams,
): Promise<Page<InternalTransaction>> {
  const shown = (it: InternalTransaction) => !NO_OWN_VALUE.has(it.type)
  const items: InternalTransaction[] = []
  let cursor = start
  for (let chunk = 0; chunk < MAX_CHUNKS; chunk++) {
    const page = await fetchPage({ ...cursor, items_count: size })
    for (const [i, it] of page.items.entries()) {
      if (!shown(it)) continue
      items.push(it)
      if (items.length === size) {
        const more = page.items.slice(i + 1).some(shown) || page.next_page_params !== null
        return {
          items,
          next_page_params: more ? { block_number: it.block_number, transaction_index: it.transaction_index, index: it.index } : null,
        }
      }
    }
    if (page.next_page_params === null) return { items, next_page_params: null }
    cursor = page.next_page_params
  }
  // A long run of hidden rows: show what was found and let the next page carry on after the last row examined.
  return { items, next_page_params: cursor }
}

/**
 * Route params arrive URL-decoded, so a segment built from one ("../x", "1?y=2") would point the request at another
 * Blockscout endpoint. Every segment this app sends is a hash, a number or a fixed word; anything else names nothing
 * that can exist, and answers as a 404 does.
 */
const SEGMENT = /^[0-9A-Za-z_-]+$/

function apiUrl(path: string): URL {
  if (!path.startsWith('/') || !path.slice(1).split('/').every((s) => SEGMENT.test(s))) throw new NotFoundError(path)
  return new URL(API() + path)
}

/** One Blockscout v2 call (`path` after /api/v2). Shared by the per-area data modules (lib/*-api.ts). */
export async function get<T>(path: string, params?: PageParams): Promise<T> {
  const url = apiUrl(path)
  if (params) for (const [k, v] of Object.entries(params)) if (v !== null) url.searchParams.set(k, String(v))
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (res.status === 404) throw new NotFoundError(path)
  if (!res.ok) throw new Error(`Blockscout ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as T
}

export const api = {
  stats: () => get<Stats>('/stats'),
  txChart: () => get<{ chart_data: ChartPoint[] }>('/stats/charts/transactions'),
  latestBlocks: () => get<Block[]>('/main-page/blocks'),
  latestTxs: () => get<Transaction[]>('/main-page/transactions'),

  blocks: (p?: PageParams) => get<Page<Block>>('/blocks', { type: 'block', ...p }),
  block: (id: string) => get<Block>(`/blocks/${id}`),
  blockTxs: (id: string, p?: PageParams) => get<Page<Transaction>>(`/blocks/${id}/transactions`, p),

  txs: (p?: PageParams) => get<Page<Transaction>>('/transactions', { filter: 'validated', ...p }),
  internalTxs: (size: number, p: PageParams) =>
    etherscanInternal((q) => get<Page<InternalTransaction>>('/internal-transactions', { ...q, include_zero_value: false }), size, p),
  // Etherscan's /tokentxns is ERC-20 only (NFT transfers have their own pages). Blockscout does not echo `type` in
  // its next-page cursor, so it is set on every call.
  erc20Transfers: (p?: PageParams) => get<Page<TokenTransfer>>('/token-transfers', { ...p, type: 'ERC-20' }),
  addressErc20Transfers: (hash: string, p?: PageParams) =>
    get<Page<TokenTransfer>>(`/addresses/${hash}/token-transfers`, { ...p, type: 'ERC-20' }),
  addressInternalValued: (hash: string, size: number, p: PageParams) =>
    etherscanInternal((q) => get<Page<InternalTransaction>>(`/addresses/${hash}/internal-transactions`, { ...q, include_zero_value: false }), size, p),
  tx: (hash: string) => get<Transaction>(`/transactions/${hash}`),
  txTokenTransfers: (hash: string, p?: PageParams) => get<Page<TokenTransfer>>(`/transactions/${hash}/token-transfers`, p),
  txInternal: (hash: string, p?: PageParams) => get<Page<InternalTransaction>>(`/transactions/${hash}/internal-transactions`, p),
  txLogs: (hash: string, p?: PageParams) => get<Page<Log>>(`/transactions/${hash}/logs`, p),

  address: (hash: string) => get<AddressInfo>(`/addresses/${hash}`),
  addressCounters: (hash: string) => get<AddressCounters>(`/addresses/${hash}/counters`),
  addressTxs: (hash: string, p?: PageParams) => get<Page<Transaction>>(`/addresses/${hash}/transactions`, p),
  addressTokenTransfers: (hash: string, p?: PageParams) => get<Page<TokenTransfer>>(`/addresses/${hash}/token-transfers`, p),
  addressTokens: (hash: string, p?: PageParams) => get<Page<TokenBalance>>(`/addresses/${hash}/tokens`, p),
  contract: (hash: string) => get<SmartContract>(`/smart-contracts/${hash}`),

  tokens: (p?: PageParams) => get<Page<TokenInfo>>('/tokens', p),
  token: (hash: string) => get<TokenInfo>(`/tokens/${hash}`),
  tokenTransfers: (hash: string, p?: PageParams) => get<Page<TokenTransfer>>(`/tokens/${hash}/transfers`, p),
  tokenHolders: (hash: string, p?: PageParams) =>
    get<Page<{ address: AddressParam; value: string }>>(`/tokens/${hash}/holders`, p),

  tokenCounters: (hash: string) => get<{ transfers_count: string; token_holders_count: string }>(`/tokens/${hash}/counters`),

  /** The most rows Blockscout writes into one CSV export file. */
  csvConfig: () => get<{ limit: number }>('/config/csv-export'),

  searchRedirect: (q: string) => get<SearchRedirect>('/search/check-redirect', { q }),
  search: (q: string) => get<Page<SearchItem>>('/search', { q }),
}

/**
 * An address's transaction total as Etherscan counts it. Blockscout's `transactions_count` counts transactions sent
 * from or to the address only (Counters.address_hash_to_transaction_count_query), yet its transaction list also holds
 * the transaction that deployed the address directly (`to` null, `created_contract` = the address). Etherscan counts
 * that one too, so it is added here; a contract made by another contract has no such transaction.
 */
export async function addressTxTotal(a: AddressInfo, counters: AddressCounters): Promise<number> {
  const counted = Number(counters.transactions_count)
  if (a.creation_transaction_hash === null) return counted
  const creation = await api.tx(a.creation_transaction_hash)
  const direct = creation.created_contract !== null && creation.created_contract.hash.toLowerCase() === a.hash.toLowerCase()
  return direct ? counted + 1 : counted
}

/** What Blockscout's CSV export can cover: a date range (whole UTC days) of an address's or a token's records, or a token's holders. */
export type CsvSource =
  | { kind: 'transactions' | 'internal-transactions' | 'token-transfers'; address: string; from: string; to: string }
  | { kind: 'token-transfers-of-token'; token: string; from: string; to: string }
  | { kind: 'holders'; token: string }

/**
 * One Blockscout CSV export, as text, with the most rows Blockscout puts in one file (`/config/csv-export`). A file
 * holding exactly that many rows may have been cut short. `from`/`to` are YYYY-MM-DD; the range takes both days whole.
 * An address Blockscout has never seen answers 404 (NotFoundError).
 */
export async function csvExport(src: CsvSource): Promise<{ text: string; limit: number }> {
  const path =
    src.kind === 'holders'
      ? `/tokens/${src.token}/holders/csv`
      : src.kind === 'token-transfers-of-token'
        ? `/tokens/${src.token}/transfers/csv`
        : `/addresses/${src.address}/${src.kind}/csv`
  const url = apiUrl(path)
  if (src.kind !== 'holders') {
    url.searchParams.set('from_period', `${src.from}T00:00:00Z`)
    url.searchParams.set('to_period', `${src.to}T23:59:59Z`)
  }
  const [res, config] = await Promise.all([fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(120_000) }), api.csvConfig()])
  if (res.status === 404) throw new NotFoundError(path)
  if (!res.ok) throw new Error(`Blockscout ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`)
  return { text: await res.text(), limit: config.limit }
}

/** Blockscout's Etherscan-compatible API lives beside v2: BLOCKSCOUT_API_URL ".../api/v2" → ".../api". */
function legacyBase(): string {
  const v2 = API()
  if (!v2.endsWith('/v2')) throw new Error(`BLOCKSCOUT_API_URL must end in /api/v2, got ${v2}`)
  return v2.slice(0, -'/v2'.length)
}

/** One legacy-API call. It answers status "0" with an empty list when a page has no rows, and a null result on errors. */
export async function legacy<T>(params: Record<string, string>): Promise<T[]> {
  const url = new URL(legacyBase())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Blockscout legacy API ${res.status} on ${params.module}.${params.action}`)
  const body = (await res.json()) as { status: string; message: string; result: T[] | null }
  if (!Array.isArray(body.result)) throw new Error(`Blockscout legacy API ${params.module}.${params.action}: ${body.message}`)
  return body.result
}

/**
 * Page cursors for the lists that can open any page by number. The legacy API pages by offset; the last row of page
 * N-1 is exactly the v2 cursor of page N (same order, verified against v2 page 2 on 2026-11-01). Null means the page
 * is past the end of the list.
 */
export const jump = {
  async addressTxs(hash: string, page: number, size: number): Promise<PageParams | null> {
    const rows = await legacy<{ blockNumber: string; transactionIndex: string }>({
      module: 'account',
      action: 'txlist',
      address: hash,
      page: String(page - 1),
      offset: String(size),
      sort: 'desc',
    })
    const last = rows.at(-1)
    if (rows.length < size || last === undefined) return null
    return { block_number: Number(last.blockNumber), index: Number(last.transactionIndex) }
  },

  async tokenHolders(token: string, page: number, size: number): Promise<PageParams | null> {
    const rows = await legacy<{ address: string; value: string }>({
      module: 'token',
      action: 'getTokenHolders',
      contractaddress: token,
      page: String(page - 1),
      offset: String(size),
    })
    const last = rows.at(-1)
    if (rows.length < size || last === undefined) return null
    return { value: last.value, address_hash: last.address.toLowerCase() }
  },

  /** Blocks are numbered without gaps from 0, so page N starts right below `top - (N-1)·size + 1`. */
  blocks: (top: number, page: number, size: number): PageParams | null => {
    const below = top - (page - 1) * size + 1
    return below > 0 ? { block_number: below } : null
  },
}

export interface RpcCall {
  method: string
  params: unknown[]
}

/** One JSON-RPC batch against our own node; replies come back in call order, each a result or the node's error text. */
export async function rpcBatch(calls: RpcCall[], timeoutMs = 15_000): Promise<({ result: unknown } | { error: string })[]> {
  if (calls.length === 0) return []
  const res = await fetch(RPC(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(calls.map((c, id) => ({ jsonrpc: '2.0', id, ...c }))),
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`node RPC ${res.status}`)
  const out = (await res.json()) as { id: number; result?: unknown; error?: { message: string } }[]
  return calls.map((_, id) => {
    const r = out.find((x) => x.id === id)
    if (!r) return { error: 'missing from batch reply' }
    return r.error ? { error: r.error.message } : { result: r.result }
  })
}

/** Block numbers for the node's `safe` and `finalized` tags (Blockscout has no field for them). */
export async function safeAndFinalized(): Promise<{ safe: number; finalized: number }> {
  const body = JSON.stringify([
    { jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: ['safe', false] },
    { jsonrpc: '2.0', id: 2, method: 'eth_getBlockByNumber', params: ['finalized', false] },
  ])
  const res = await fetch(RPC(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(5_000),
  })
  if (!res.ok) throw new Error(`node RPC ${res.status}`)
  const out = (await res.json()) as { id: number; result: { number: string } | null; error?: { message: string } }[]
  const num = (id: number) => {
    const r = out.find((x) => x.id === id)
    if (!r?.result) throw new Error(`node RPC: no block for id ${id}: ${r?.error?.message ?? 'empty result'}`)
    return Number.parseInt(r.result.number, 16)
  }
  return { safe: num(1), finalized: num(2) }
}
