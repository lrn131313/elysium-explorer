// Data for the chain team's pages (Top Accounts, Verified Contracts, the bridge message lists, Gas Tracker, Charts).
// Server-side only: built on lib/api.ts, which reads the server env vars.
import { get, rpcBatch, type RpcCall } from './api'
import { isAddress } from './format'
import type { Cursor } from './paging'
import type { AddressParam, Page, PageParams } from './types'

// ---------- Top Accounts (/accounts) ----------

/** One row of `/api/v2/addresses`. `transactions_count` is "" while Blockscout has not counted the address yet. */
export interface TopAccount extends AddressParam {
  coin_balance: string
  transactions_count: string
}

/**
 * Blockscout serves the first page of `/addresses` from a cache that holds 51 rows (Explorer.Chain.Cache.Accounts,
 * max_size 51). A first page asked for more than 50 rows comes back cut to those 51, with no next page. A bigger first
 * page is therefore fetched as 50 rows plus the rest from the cursor after them.
 */
const ACCOUNTS_FIRST_PAGE = 50

/** Blockscout's cursor for this list: the last row's balance, transaction count and hash. */
export interface AccountsCursor {
  fetched_coin_balance: string
  hash: string
  transactions_count: number | null
}

/** The cursor a Top Accounts link carries, or null when it is not one Blockscout gave (a hand-edited link). */
export function accountsCursor(c: Cursor | PageParams): AccountsCursor | null {
  const { fetched_coin_balance, hash, transactions_count } = c
  if (typeof fetched_coin_balance !== 'string' || !/^\d{1,78}$/.test(fetched_coin_balance)) return null
  if (typeof hash !== 'string' || !isAddress(hash)) return null
  if (transactions_count !== null && (typeof transactions_count !== 'number' || !Number.isSafeInteger(transactions_count) || transactions_count < 0)) return null
  return { fetched_coin_balance, hash, transactions_count }
}

/**
 * Blockscout reads this list's cursor only when all three keys are present (BlockScoutWeb.Chain do_paging_options).
 * An address it has not counted yet has a null `transactions_count`, which must still be sent, as an empty value, or
 * the list silently starts over from the top. `get` drops null params, hence the empty string.
 */
const accountsParams = (c: AccountsCursor): PageParams => ({
  ...c,
  transactions_count: c.transactions_count === null ? '' : c.transactions_count,
})

/** One page of the addresses holding HYPE, largest balance first. `cursor` is the walk cursor of this page (none for page 1). */
export async function topAccounts(size: number, cursor: AccountsCursor | null): Promise<Page<TopAccount>> {
  if (cursor !== null) return get<Page<TopAccount>>('/addresses', { ...accountsParams(cursor), items_count: size })
  if (size <= ACCOUNTS_FIRST_PAGE) return get<Page<TopAccount>>('/addresses', { items_count: size })
  const head = await get<Page<TopAccount>>('/addresses', { items_count: ACCOUNTS_FIRST_PAGE })
  if (head.next_page_params === null) return head
  const after = accountsCursor(head.next_page_params)
  if (after === null) throw new Error(`/addresses gave an unexpected cursor: ${JSON.stringify(head.next_page_params)}`)
  const rest = await get<Page<TopAccount>>('/addresses', { ...accountsParams(after), items_count: size - ACCOUNTS_FIRST_PAGE })
  return { items: [...head.items, ...rest.items], next_page_params: rest.next_page_params }
}

/** Blockscout's Etherscan-compatible API sits beside v2: ".../api/v2" → ".../api". */
function legacyUrl(params: Record<string, string>): URL {
  const v2 = process.env.BLOCKSCOUT_API_URL
  if (!v2) throw new Error('BLOCKSCOUT_API_URL is not set (see web/.env.local)')
  if (!v2.endsWith('/v2')) throw new Error(`BLOCKSCOUT_API_URL must end in /api/v2, got ${v2}`)
  const url = new URL(v2.slice(0, -'/v2'.length))
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url
}

/**
 * A legacy-API call whose result is one value rather than a list (lib/api.ts `legacy` reads lists only). Null is the
 * API's "no data" answer (status "1", result null); status "0" is an error.
 */
async function legacyValue(params: Record<string, string>): Promise<string | null> {
  const res = await fetch(legacyUrl(params), { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Blockscout legacy API ${res.status} on ${params.module}.${params.action}`)
  const body = (await res.json()) as { status: string; message: string; result: string | null }
  if (body.status !== '1') throw new Error(`Blockscout legacy API ${params.module}.${params.action}: ${body.message}`)
  return body.result
}

/**
 * All HYPE held on Elysium, in wei: the sum of every address's balance (legacy `stats.ethsupply`, Blockscout's cached
 * AddressesAggregates sum). Checked on 2026-11-01 against a full walk of `/addresses`: 27,441.834 HYPE both ways.
 * Blockscout's own `total_supply` on `/addresses` is HYPE's global market supply, not what is on this chain.
 */
export async function coinHeld(): Promise<bigint> {
  const sum = await legacyValue({ module: 'stats', action: 'ethsupply' })
  if (sum === null || !/^\d+$/.test(sum)) throw new Error(`stats.ethsupply returned ${String(sum)}`)
  return BigInt(sum)
}

// ---------- Verified Contracts (/contractsVerified) ----------

export type ContractLanguage = 'solidity' | 'vyper' | 'yul' | 'geas' | 'stylus_rust'

/** Blockscout's licence enum (Explorer.Chain.SmartContract @license_enum). */
export type LicenseType =
  | 'none'
  | 'unlicense'
  | 'mit'
  | 'gnu_gpl_v2'
  | 'gnu_gpl_v3'
  | 'gnu_lgpl_v2_1'
  | 'gnu_lgpl_v3'
  | 'bsd_2_clause'
  | 'bsd_3_clause'
  | 'mpl_2_0'
  | 'osl_3_0'
  | 'apache_2_0'
  | 'gnu_agpl_v3'
  | 'bsl_1_1'

export interface VerifiedContract {
  address: AddressParam
  coin_balance: string
  compiler_version: string | null
  has_constructor_args: boolean
  language: ContractLanguage
  license_type: LicenseType | null
  optimization_enabled: boolean | null
  /** Null while Blockscout has not counted the address yet (ArbOS precompiles, for one). */
  transactions_count: number | null
  verified_at: string
}

export interface ContractCounters {
  smart_contracts: string
  new_smart_contracts_24h: string
  verified_smart_contracts: string
  new_verified_smart_contracts_24h: string
}

/** A cursor taken from a link is Blockscout's `{smart_contract_id}` for this list, or the link was edited by hand. */
export function isContractsCursor(c: Cursor): boolean {
  const keys = Object.keys(c)
  return keys.length === 1 && Number.isSafeInteger(c.smart_contract_id)
}

/**
 * Verified contracts, newest verification first. Blockscout does not echo `filter` or `q` in its next-page cursor, so
 * both are set on every call (`get` drops the null ones).
 */
export const verifiedContracts = (params: PageParams, filter: ContractLanguage | null, q: string | null) =>
  get<Page<VerifiedContract>>('/smart-contracts', { ...params, filter, q })

export const contractCounters = () => get<ContractCounters>('/smart-contracts/counters')

// ---------- Bridge messages (/txsExit, /txsDeposits) ----------

/** Blockscout's Arbitrum message (Explorer.Chain.Arbitrum.Message, status enum). */
export interface ArbMessage {
  id: number
  status: 'initiated' | 'sent' | 'confirmed' | 'relayed'
  origination_address_hash: string | null
  origination_timestamp: string | null
  origination_transaction_block_number: number | null
  origination_transaction_hash: string | null
  completion_transaction_hash: string | null
}

/** Elysium → HyperEVM messages (withdrawals), newest first. */
export const exitMessages = (params: PageParams) => get<Page<ArbMessage>>('/arbitrum/messages/from-rollup', params)
export const exitCount = () => get<number>('/arbitrum/messages/from-rollup/count')

/**
 * The cursor of page `page` of the exits. An exit's id is its position in ArbSys's send list, numbered without gaps
 * from 0 (checked 2026-11-01: 602 exits, newest id 601), so page N starts right below `count - (N-1)·size`.
 */
export function exitJump(count: number, page: number, size: number): PageParams | null {
  const below = count - (page - 1) * size
  return below > 0 ? { id: below } : null
}
/** A cursor taken from a link is Blockscout's `{id}` for the deposits list, or the link was edited by hand. */
export function isIdCursor(c: Cursor): boolean {
  return Object.keys(c).length === 1 && Number.isSafeInteger(c.id)
}

/** HyperEVM → Elysium messages (deposits), newest first. */
export const depositMessages = (params: PageParams) => get<Page<ArbMessage>>('/arbitrum/messages/to-rollup', params)
export const depositCount = () => get<number>('/arbitrum/messages/to-rollup/count')

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The `result` of each reply in a batch; a node error fails the whole call (the page cannot be drawn without it). */
async function rpcResults(calls: RpcCall[]): Promise<unknown[]> {
  const replies = await rpcBatch(calls)
  return calls.map((c, i) => {
    const r = replies[i]
    if (r === undefined) throw new Error(`node RPC ${c.method}: no reply in the batch`)
    if ('error' in r) throw new Error(`node RPC ${c.method}: ${r.error}`)
    return r.result
  })
}

/** A hex quantity field of a node reply object. */
function hexField(o: unknown, key: string, what: string): bigint {
  if (!isRecord(o)) throw new Error(`node RPC: no ${what}`)
  const v = o[key]
  if (typeof v !== 'string' || !/^0x[0-9a-f]+$/i.test(v)) throw new Error(`node RPC: ${what} has no ${key}`)
  return BigInt(v)
}

/**
 * When each of these Elysium transactions was included (ISO time, keyed by lower-case hash), read from our own node:
 * one batch for the transactions' blocks, one for those blocks' times.
 */
export async function txTimes(hashes: string[]): Promise<Map<string, string>> {
  if (hashes.length === 0) return new Map()
  const txs = await rpcResults(hashes.map((h) => ({ method: 'eth_getTransactionByHash', params: [h] })))
  const blockOf = txs.map((t, i) => hexField(t, 'blockNumber', `transaction ${hashes[i]}`))
  const blocks = [...new Set(blockOf)]
  const heads = await rpcResults(blocks.map((b) => ({ method: 'eth_getBlockByNumber', params: [`0x${b.toString(16)}`, false] })))
  const timeOf = new Map(blocks.map((b, i) => [b, new Date(Number(hexField(heads[i], 'timestamp', `block ${b}`)) * 1000).toISOString()]))
  return new Map(
    hashes.map((h, i) => {
      const block = blockOf[i]
      const time = block === undefined ? undefined : timeOf.get(block)
      if (time === undefined) throw new Error(`node RPC: no time for ${h}`)
      return [h.toLowerCase(), time]
    }),
  )
}

// ---------- Gas Tracker (/gastracker) ----------

/**
 * Blockscout's own gas oracle defaults (config/runtime.exs: GAS_PRICE_ORACLE_NUM_OF_BLOCKS 200, percentiles 35/60/90),
 * applied to the node's fee history. Blockscout's oracle itself is not used: it projects the next base fee with the
 * Ethereum EIP-1559 formula, which on Elysium falls below the 0.1 gwei floor ArbOS enforces (it read 0.09 gwei on
 * 2026-11-01 while every block paid 0.1).
 */
const FEE_BLOCKS = 200
const PERCENTILES = [35, 60, 90] as const
/** Any address works as the target of a plain transfer estimate; the gas does not depend on it. */
const TRANSFER_TO = '0x000000000000000000000000000000000000dEaD'

export interface GasTier {
  base: bigint
  priority: bigint
}

export interface GasOracle {
  /** The base fee the next block will charge, wei per gas. */
  baseFee: bigint
  standard: GasTier
  fast: GasTier
  rapid: GasTier
  /** How many recent blocks with transactions the priority fees were read from. */
  sampled: number
  head: number
  /** Gas a plain HYPE transfer needs now (eth_estimateGas), including the parent-chain data part ArbOS adds. */
  transferGas: bigint
}

function hexList(o: Record<string, unknown>, key: string): string[] {
  const v = o[key]
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) throw new Error(`eth_feeHistory: bad ${key}`)
  return v
}

export async function gasOracle(): Promise<GasOracle> {
  const [history, estimate, head] = await rpcResults([
    { method: 'eth_feeHistory', params: [`0x${FEE_BLOCKS.toString(16)}`, 'latest', [...PERCENTILES]] },
    { method: 'eth_estimateGas', params: [{ to: TRANSFER_TO, value: '0x0' }] },
    { method: 'eth_blockNumber', params: [] },
  ])
  if (!isRecord(history)) throw new Error('eth_feeHistory: no result')
  const bases = hexList(history, 'baseFeePerGas')
  const ratios = history.gasUsedRatio
  const rewards = history.reward
  if (!Array.isArray(ratios) || !Array.isArray(rewards)) throw new Error('eth_feeHistory: no gasUsedRatio or reward')
  const next = bases.at(-1)
  if (next === undefined) throw new Error('eth_feeHistory: empty baseFeePerGas')
  // A block with no gas used reports zero rewards by definition; only blocks that carried transactions say what was paid.
  const used = rewards.filter((_, i) => typeof ratios[i] === 'number' && ratios[i] > 0)
  const tier = (p: number): bigint => {
    if (used.length === 0) return 0n
    let sum = 0n
    for (const r of used) {
      if (!Array.isArray(r) || typeof r[p] !== 'string') throw new Error('eth_feeHistory: bad reward row')
      sum += BigInt(r[p])
    }
    return sum / BigInt(used.length)
  }
  if (typeof estimate !== 'string' || typeof head !== 'string') throw new Error('node RPC: bad eth_estimateGas or eth_blockNumber')
  const baseFee = BigInt(next)
  return {
    baseFee,
    standard: { base: baseFee, priority: tier(0) },
    fast: { base: baseFee, priority: tier(1) },
    rapid: { base: baseFee, priority: tier(2) },
    sampled: used.length,
    head: Number(BigInt(head)),
    transferGas: BigInt(estimate),
  }
}

/** One row of Blockscout's hot-contracts list: gas and transactions sent to a contract within the chosen window. */
export interface HotContract {
  contract_address: AddressParam
  transactions_count: string
  total_gas_used: string
  balance: string
}

/**
 * The contracts that used the most gas in the last 3 hours. Blockscout's daily windows (1d, 7d, 30d) come back empty
 * here: they read an aggregate table this instance does not fill (checked 2026-11-01), so the 24-hour columns of
 * Etherscan's table have no source.
 */
export const gasGuzzlers = () =>
  get<Page<HotContract>>('/stats/hot-smart-contracts', { scale: '3h', sort: 'total_gas_used', order: 'desc', items_count: 50 })

/** The newest blocks, for the "transactions per block" figure. */
export const recentBlocks = (n: number) => get<Page<{ height: number; transactions_count: number }>>('/blocks', { type: 'block', items_count: n })

// ---------- Charts & Stats (/charts) ----------

export interface TxStats {
  transactions_count_24h: string
  transaction_fees_sum_24h: string
  transaction_fees_avg_24h: string
}

/** Transactions and fees of the last 24 hours. */
export const txStats = () => get<TxStats>('/transactions/stats')

export interface MarketPoint {
  date: string
  closing_price: string | null
  market_cap: string | null
}

/** HYPE's daily closing price and market capitalisation (USD, CoinGecko via Blockscout), the last 30 days. */
export const marketChart = () => get<{ chart_data: MarketPoint[] }>('/stats/charts/market')

/** A day's fee total, once Blockscout has written it, never changes: kept for the life of the process. */
const feesByDay = new Map<string, bigint>()

/** "YYYY-MM-DD", `back` UTC days before today. */
function utcDay(back: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - back)
  return d.toISOString().slice(0, 10)
}

/**
 * Total transaction fees paid on each of these UTC days (YYYY-MM-DD), in wei; null for a day with no record (before
 * the chain started). Legacy `stats.totalfees`, which reads Blockscout's daily table, the same one behind the
 * transactions chart. Blockscout writes a day's row after the day ends (today reads "0"), so only days older than
 * yesterday are kept.
 */
export async function dailyFees(days: string[]): Promise<Map<string, bigint | null>> {
  const settled = utcDay(1)
  const fetched = await Promise.all(
    days
      .filter((d) => !feesByDay.has(d))
      .map(async (d) => {
        const v = await legacyValue({ module: 'stats', action: 'totalfees', date: d })
        if (v !== null && !/^\d+$/.test(v)) throw new Error(`stats.totalfees ${d} returned ${v}`)
        return [d, v === null ? null : BigInt(v)] as const
      }),
  )
  for (const [d, v] of fetched) if (v !== null && d < settled) feesByDay.set(d, v)
  const now = new Map<string, bigint | null>(fetched)
  return new Map(
    days.map((d) => {
      const kept = feesByDay.get(d)
      if (kept !== undefined) return [d, kept]
      const v = now.get(d)
      if (v === undefined) throw new Error(`no fee total read for ${d}`)
      return [d, v]
    }),
  )
}
