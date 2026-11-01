// Blockscout calls for the lists team's pages (lib/api.ts is shared and frozen).
import { addressTxTotal, api, get, legacy } from './api'
import { SharedCache } from './lists-cache'
import type { AddressInfo, Page, PageParams, TokenInfo, Transaction } from './types'

/** Blockscout's legacy API serves rows 1..10,000 of a list only: page × offset above that answers "Result window is too large". */
export const LEGACY_WINDOW = 10_000

/*
 * Measured totals are cached in process (SharedCache: one run per burst of identical requests, failures not kept,
 * expired entries dropped, at most CACHE_ENTRIES keys). Per uncached request the Blockscout calls are bounded where
 * each total is measured (see measure, findCreations, walkTokenCount); rate limiting per visitor is not done here.
 */
const CACHE_ENTRIES = 500
/** Per-address totals and creation lists: a minute, so paging through one list does not measure it again. */
const ADDRESS_TTL_MS = 60_000
/** Token counts change slowly: five minutes. */
const TOKEN_TTL_MS = 5 * 60_000

/** `/transactions/stats`: the last 24 hours (amounts in wei, decimal strings). Pending is always 0 here: no public mempool. */
export interface TxStats {
  transactions_count_24h: string
  transaction_fees_sum_24h: string
  transaction_fees_avg_24h: string
  pending_transactions_count: string
}
export const txStats = () => get<TxStats>('/transactions/stats')

/** A `/tokens` item: TokenInfo plus the 24h volume (USD) that lib/types.ts leaves out. Market fields are null without a price source. */
export interface TokenRow extends TokenInfo {
  volume_24h: string | null
}

/** Blockscout's sorts for `/tokens`; without one it orders by circulating market cap, then price, then holders (Token @default_sorting). */
export type TokenSort = 'fiat_value' | 'circulating_market_cap' | 'holders_count'

/**
 * The `/tokens` cursor carries `fiat_value` and `market_cap`, null for every token without a price, and Blockscout
 * needs them back: without them it pages from the wrong key and hands out the same cursor again (seen 2026-11-01).
 * lib/api's get() leaves null parameters out, so they are sent as "null", which Blockscout reads as no value.
 */
function keepNulls(cursor: PageParams): PageParams {
  return Object.fromEntries(Object.entries(cursor).map(([k, v]) => [k, v === null ? 'null' : v]))
}

/**
 * One page of the ERC-20 token list, or of the tokens whose name or symbol has a word starting with `q` (or whose
 * address is exactly `q`; Blockscout's search, which finds nothing for a part of an address or for words like "a").
 * Blockscout echoes neither the type nor the sort in its cursor, so both go on every call.
 */
export function erc20Tokens(cursor: PageParams, size: number, sort: { by: TokenSort; order: 'asc' | 'desc' } | null, q: string | null): Promise<Page<TokenRow>> {
  return get<Page<TokenRow>>('/tokens', {
    ...keepNulls(cursor),
    items_count: size,
    type: 'ERC-20',
    ...(sort === null ? {} : { sort: sort.by, order: sort.order }),
    ...(q === null ? {} : { q }),
  })
}

const tokenCounts = new SharedCache<number>(TOKEN_TTL_MS, CACHE_ENTRIES)

/**
 * How many ERC-20 tokens Blockscout lists ("A total of N Token Contracts found"), all or those matching `q`. It keeps
 * no such total, so the list is walked; the result is cached (TOKEN_TTL_MS).
 */
export function countErc20Tokens(q: string | null): Promise<number> {
  return tokenCounts.get(q === null ? 'all' : `q:${q}`, () => walkTokenCount(q))
}

/** ⌈N/100⌉ calls of 100 rows: 14 for the 1,345 tokens on 2026-11-01 (0.2 s); a search reads only its matches. */
async function walkTokenCount(q: string | null): Promise<number> {
  let n = 0
  let cursor: PageParams = {}
  for (;;) {
    const page = await erc20Tokens(cursor, 100, null, q)
    n += page.items.length
    if (page.next_page_params === null) break
    // A cursor that points at itself would walk forever; it is what a mis-sent cursor produced (see keepNulls).
    if (JSON.stringify(page.next_page_params) === JSON.stringify(cursor)) throw new Error(`Blockscout /tokens repeated its cursor ${JSON.stringify(cursor)}`)
    cursor = page.next_page_params
  }
  return n
}

/**
 * Etherscan's /txs?a= filters: `f=2` outgoing, `f=3` incoming, `f=5` contract creation. A Map, not an object: `f` comes
 * from the URL, and an object lookup would answer `f=constructor` or `f=__proto__` with Object's own members.
 */
export type TxFilter = 'from' | 'to' | 'creation'
export const TX_FILTER_PARAM: ReadonlyMap<string, TxFilter> = new Map([
  ['2', 'from'],
  ['3', 'to'],
  ['5', 'creation'],
])

interface LegacyTx {
  hash: string
  blockNumber: string
  transactionIndex: string
  /** Empty for a transaction that deploys a contract (no recipient); `contractAddress` then holds what it deployed. */
  to: string
}

/** One address's transactions, all or only those it sent (`from`) or received (`to`), newest first, from `cursor`. */
export function addressTxsFiltered(hash: string, filter: 'from' | 'to' | null, cursor: PageParams, size: number): Promise<Page<Transaction>> {
  return get<Page<Transaction>>(`/addresses/${hash}/transactions`, filter === null ? { ...cursor, items_count: size } : { ...cursor, filter, items_count: size })
}

/** Row `k` (from 1) of an address's legacy transaction list, newest first; null past its end. `k` must be within the window. */
async function txRow(hash: string, filter: 'from' | 'to' | null, k: number): Promise<LegacyTx | null> {
  const rows = await legacy<LegacyTx>({
    module: 'account',
    action: 'txlist',
    address: hash,
    ...(filter === null ? {} : { filter_by: filter }),
    page: String(k),
    offset: '1',
    sort: 'desc',
  })
  const row = rows[0]
  return row === undefined ? null : row
}

/** The v2 cursor that continues a list right after legacy row `row` (same order: verified 2026-11-01, filtered and not). */
const after = (row: LegacyTx): PageParams => ({ block_number: Number(row.blockNumber), index: Number(row.transactionIndex) })

/**
 * Cursor for page `page` of `size` rows of an address's transactions (filtered by direction or not): the last row of
 * the page before it. Null when that page starts past the end of the list. The page must start within the window.
 */
export async function addressTxsCursor(hash: string, filter: 'from' | 'to' | null, page: number, size: number): Promise<PageParams | null> {
  if (page === 1) return {}
  const rows = await legacy<LegacyTx>({
    module: 'account',
    action: 'txlist',
    address: hash,
    ...(filter === null ? {} : { filter_by: filter }),
    page: String(page - 1),
    offset: String(size),
    sort: 'desc',
  })
  const last = rows.at(-1)
  if (rows.length < size || last === undefined) return null
  return after(last)
}

export interface Count {
  /** Rows counted, at most LEGACY_WINDOW. */
  count: number
  /** True when the list goes on past the window, so `count` is a lower bound. */
  more: boolean
}

const counts = new SharedCache<Count>(ADDRESS_TTL_MS, CACHE_ENTRIES)

/**
 * How many transactions an address has: all of them (null), or those it sent (`from`) or received (`to`). Blockscout
 * keeps no counter per direction, and its address counter (`transactions_count`) lags the list on a busy address
 * (7,761 for 0xdB22…DB22, whose list has 8,563 rows, 2026-11-01), so the list is measured: single-row legacy probes,
 * doubling until a row is missing, then halving the gap; cached (ADDRESS_TTL_MS) so paging does not repeat it.
 */
export function countAddressTxs(hash: string, filter: 'from' | 'to' | null): Promise<Count> {
  return counts.get(`${hash.toLowerCase()}:${filter === null ? 'all' : filter}`, () => measure(hash, filter))
}

/**
 * An address's transaction total as its lists show it (the address page and /txs?a=): measured exactly within the
 * legacy window; past it, Blockscout's counter as a lower bound, at least the window (the counter lags busy addresses).
 */
export async function addressTxCount(a: AddressInfo): Promise<Count> {
  const measured = await countAddressTxs(a.hash, null)
  if (!measured.more) return measured
  const counted = await addressTxTotal(a, await api.addressCounters(a.hash))
  return { count: Math.max(counted, LEGACY_WINDOW), more: true }
}

/** At most 2·log2(10,000) ≈ 28 one-row legacy calls, plus one v2 call when the list reaches the window. */
async function measure(hash: string, filter: 'from' | 'to' | null): Promise<Count> {
  if ((await txRow(hash, filter, 1)) === null) return { count: 0, more: false }
  let hit = 1
  let miss: number | null = null
  while (miss === null && hit < LEGACY_WINDOW) {
    const k = Math.min(hit * 2, LEGACY_WINDOW)
    if ((await txRow(hash, filter, k)) === null) miss = k
    else hit = k
  }
  if (miss === null) {
    // Row 10,000 exists; whether a 10,001st does, only v2 can say (it pages past the window).
    const last = await txRow(hash, filter, LEGACY_WINDOW)
    if (last === null) throw new Error(`legacy txlist row ${LEGACY_WINDOW} of ${hash} vanished while counting`)
    const beyond = await addressTxsFiltered(hash, filter, after(last), 1)
    return { count: LEGACY_WINDOW, more: beyond.items.length > 0 }
  }
  while (miss - hit > 1) {
    const mid = Math.floor((hit + miss) / 2)
    if ((await txRow(hash, filter, mid)) === null) miss = mid
    else hit = mid
  }
  return { count: hit, more: false }
}

/** Rows of the address's sent list read per legacy call while looking for creations; ten calls reach the window. */
const CREATION_SCAN = 1_000

export interface Creations {
  hashes: string[]
  /** False when the address sent more than LEGACY_WINDOW transactions, so older creations were not read. */
  complete: boolean
}
const creations = new SharedCache<Creations>(ADDRESS_TTL_MS, CACHE_ENTRIES)
const creationTxs = new SharedCache<Transaction>(ADDRESS_TTL_MS, CACHE_ENTRIES)

/**
 * One listed creation transaction. The list has hashes only, so a page looks each row up (up to its page size, 100);
 * a mined transaction does not change, so the lookups are shared: 20 identical requests for a 50-row page made 1,000
 * calls and Blockscout reset connections (2026-11-01) before they were.
 */
export function creationTx(hash: string): Promise<Transaction> {
  return creationTxs.get(hash.toLowerCase(), () => api.tx(hash))
}

/**
 * The transactions behind Etherscan's "View Contract Creation" (/txs?a=ADDR&f=5): those the address sent that deployed
 * a contract (no recipient), newest first. Blockscout has no filter for them, so the address's sent list is read from
 * the legacy API 1,000 rows a call (0.03-0.06 s each, measured 2026-11-01) up to the 10,000-row window and scanned.
 * A contract sends no transactions (an EIP-7702 account does, and is read the same way); a contract deployed directly
 * by a transaction has that transaction in its own list. Cached (ADDRESS_TTL_MS) so paging does not repeat it.
 *
 * Internal `create` traces are not used: they miss Arbitrum retry-transaction deployments (type 104; 32 of 834 found
 * for 0xdB22…DB22), and an address that also sends nested system calls (the zero address) fills that list with calls.
 */
export function creationTxHashes(a: AddressInfo): Promise<Creations> {
  return creations.get(a.hash.toLowerCase(), () => findCreations(a))
}

/**
 * At most LEGACY_WINDOW / CREATION_SCAN = 10 legacy calls of 1,000 rows, plus the sent-list count (measure) when the
 * window is reached and one transaction lookup for a directly deployed contract. The page then fetches each listed
 * transaction it shows: at most one page size (100).
 */
async function findCreations(a: AddressInfo): Promise<Creations> {
  const key = a.hash.toLowerCase()
  const hashes: string[] = []
  let complete = true
  if (!a.is_contract || a.proxy_type === 'eip7702') {
    for (let page = 1; page * CREATION_SCAN <= LEGACY_WINDOW; page++) {
      const rows = await legacy<LegacyTx>({
        module: 'account',
        action: 'txlist',
        address: a.hash,
        filter_by: 'from',
        page: String(page),
        offset: String(CREATION_SCAN),
        sort: 'desc',
      })
      for (const row of rows) if (row.to === '') hashes.push(row.hash)
      if (rows.length < CREATION_SCAN) break
      if (page * CREATION_SCAN === LEGACY_WINDOW) complete = !(await countAddressTxs(a.hash, 'from')).more
    }
  }
  if (a.creation_transaction_hash !== null && !hashes.includes(a.creation_transaction_hash)) {
    const creation = await api.tx(a.creation_transaction_hash)
    if (creation.created_contract !== null && creation.created_contract.hash.toLowerCase() === key) hashes.push(creation.hash)
  }
  return { hashes, complete }
}
