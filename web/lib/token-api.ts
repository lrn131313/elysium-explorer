// Blockscout and node calls for the token pages and the NFT lists (server only). Built on lib/api.ts.
import { api, get, NotFoundError, rpcBatch } from './api'
import type { AddressParam, Page, PageParams, TokenInfo, TokenTransfer, Transaction, TransferTotal } from './types'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/** One NFT (or ERC-1155 item) as Blockscout lists it. `image_url` is often an on-chain data: URI of several KB. */
export interface NftInstance {
  id: string
  owner: AddressParam | null
  image_url: string | null
  metadata: Record<string, unknown> | null
  token: TokenInfo
}

export interface TokenHolder {
  address: AddressParam
  value: string
  token_id: string | null
}

/** A row of Blockscout's advanced filter (used for NFT mints: transfers from the zero address). */
export interface FilteredTransfer {
  hash: string
  type: string
  method: string | null
  block_number: number
  timestamp: string | null
  from: AddressParam
  to: AddressParam | null
  token: TokenInfo | null
  total: TransferTotal | null
  token_transfer_index: number | null
}

const NFT_TYPES = 'ERC-721,ERC-1155'

export const tokenApi = {
  counters: (hash: string) => api.tokenCounters(hash),

  /** A token's NFTs, highest id first. Blockscout ignores `items_count` here (always 50); the cursor is `unique_token`. */
  instances: (hash: string, p?: PageParams) => get<Page<NftInstance>>(`/tokens/${hash}/instances`, p),
  instance: (hash: string, id: string) => get<NftInstance>(`/tokens/${hash}/instances/${id}`),
  instanceTransfers: (hash: string, id: string, p?: PageParams) => get<Page<TokenTransfer>>(`/tokens/${hash}/instances/${id}/transfers`, p),
  instanceTransfersCount: (hash: string, id: string) => get<{ transfers_count: number }>(`/tokens/${hash}/instances/${id}/transfers-count`),

  /** The chain-wide NFT transfer feed. Blockscout does not echo `type` in its cursor, so it is set on every call. */
  nftTransfers: (p?: PageParams) => get<Page<TokenTransfer>>('/token-transfers', { ...p, type: NFT_TYPES }),

  /** NFT mints, newest first: the advanced filter keeps only transfers from the zero address. */
  nftMints: (p?: PageParams) =>
    get<Page<FilteredTransfer>>('/advanced-filters', { ...keepNullKeys(p), transaction_types: NFT_TYPES, from_address_hashes_to_include: ZERO_ADDRESS }),
}

/**
 * The advanced filter's cursor always has `internal_transaction_index: null` for token transfers, and Blockscout
 * ignores the whole cursor (serving page 1 again) unless that key is in the query. `get()` leaves null values out,
 * so they are sent as empty values, which Blockscout reads as null.
 */
function keepNullKeys(p?: PageParams): PageParams {
  if (p === undefined) return {}
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v === null ? '' : v]))
}

/** The most pages of one transaction's token transfers read for the "?a=<txn hash>" view (100 per page). */
const TX_TRANSFER_PAGES = 20

/**
 * One token's transfers inside one transaction. Blockscout cannot filter that list by token, so it is read whole; its
 * rows there carry no timestamp or method, so both are taken from the transaction. A hash Blockscout does not know
 * has no transfers.
 */
export async function txTransfersOfToken(tx: string, token: string): Promise<{ items: TokenTransfer[]; complete: boolean }> {
  let info: Transaction
  try {
    info = await api.tx(tx)
  } catch (e) {
    // 404: no such transaction on this chain, so nothing of this token moved in it.
    if (e instanceof NotFoundError) return { items: [], complete: true }
    throw e
  }
  const items: TokenTransfer[] = []
  let cursor: PageParams = {}
  for (let i = 0; i < TX_TRANSFER_PAGES; i++) {
    const page = await api.txTokenTransfers(tx, { ...cursor, items_count: 100 })
    for (const t of page.items) {
      if (t.token.address_hash.toLowerCase() !== token.toLowerCase()) continue
      items.push({ ...t, timestamp: t.timestamp === null ? info.timestamp : t.timestamp, method: t.method === null ? info.method : t.method })
    }
    if (page.next_page_params === null) return { items, complete: true }
    cursor = page.next_page_params
  }
  return { items, complete: false }
}

/**
 * A holder's balance of an ERC-20 or ERC-721 token, read from the node (`balanceOf`), raw units. Null when the
 * contract does not answer the standard call (a non-standard token reverts or returns nothing).
 */
export async function balanceOf(token: string, holder: string): Promise<bigint | null> {
  const data = `0x70a08231${holder.slice(2).toLowerCase().padStart(64, '0')}`
  const [reply] = await rpcBatch([{ method: 'eth_call', params: [{ to: token, data }, 'latest'] }])
  if (reply === undefined || 'error' in reply) return null
  const out = reply.result
  if (typeof out !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(out)) return null
  return BigInt(out)
}

// ---------- full holder snapshot (Holders tab analytics) ----------

/** Above this many holders the analytics are not computed: the full pull would take more than 100 calls. */
export const SNAPSHOT_CAP = 10_000
const SNAPSHOT_TTL_MS = 60_000
const SNAPSHOT_KEEP = 200

export interface HolderSnapshot {
  /** When the pull started (ms since epoch); the page shows the snapshot's age from it. */
  at: number
  holders: TokenHolder[]
  /** False when the pull stopped at SNAPSHOT_CAP holders: the list is then only the largest ones. */
  complete: boolean
}

const snapshots = new Map<string, { at: number; promise: Promise<HolderSnapshot> }>()

async function pullHolders(hash: string, at: number): Promise<HolderSnapshot> {
  const holders: TokenHolder[] = []
  let cursor: PageParams = {}
  for (;;) {
    const page = await get<Page<TokenHolder>>(`/tokens/${hash}/holders`, { ...cursor, items_count: 100 })
    holders.push(...page.items)
    if (page.next_page_params === null) return { at, holders, complete: true }
    if (holders.length >= SNAPSHOT_CAP) return { at, holders, complete: false }
    cursor = page.next_page_params
  }
}

/**
 * Every holder of a token (Blockscout order: largest balance first), pulled 100 at a time and kept for a minute so
 * the analytics do not re-read the list on every view. Stops at SNAPSHOT_CAP holders (`complete` false).
 */
export function holderSnapshot(hash: string): Promise<HolderSnapshot> {
  const key = hash.toLowerCase()
  const now = Date.now()
  const hit = snapshots.get(key)
  if (hit && now - hit.at < SNAPSHOT_TTL_MS) return hit.promise
  const promise = pullHolders(hash, now)
  snapshots.delete(key)
  snapshots.set(key, { at: now, promise })
  // A failed pull is not kept: the next view tries again. The failure itself still reaches every caller of `promise`.
  promise.catch(() => {
    if (snapshots.get(key)?.promise === promise) snapshots.delete(key)
  })
  while (snapshots.size > SNAPSHOT_KEEP) {
    const oldest = snapshots.keys().next()
    if (oldest.done) break
    snapshots.delete(oldest.value)
  }
  return promise
}
