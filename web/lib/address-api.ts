// Data for the address page (app/address/[addr]), server-side only. Built on lib/api.ts's `get` / `legacy` / `rpcBatch`.
import { cache } from 'react'
import { api, get, legacy, rpcBatch } from './api'
import type { AddressInfo, AddressParam, Page, PageParams, TokenInfo, Transaction } from './types'

/** One row of `/addresses/{a}/token-balances`: every token the address holds now, unpaged. */
export interface HeldToken {
  token: TokenInfo
  token_id: string | null
  value: string
}

/** One row of `/addresses/{a}/logs`: an event the contract emitted. `decoded` is null when Blockscout has no ABI for it. */
export interface AddressLog {
  transaction_hash: string
  block_number: number
  block_timestamp: string | null
  index: number
  topics: (string | null)[]
  data: string
  decoded: { method_call: string; method_id: string; parameters: { name: string; type: string; value: unknown; indexed: boolean }[] } | null
  address: AddressParam
}

/** A transaction, as the overview cards link it: its hash and when it was mined. */
export interface TxRef {
  hash: string
  timestamp: string
}

/** The same transaction or address is asked for by more than one part of a page (More Info, Contract tab): one call per request. */
export const txOf = cache((hash: string) => api.tx(hash))
export const addressOf = cache((hash: string) => api.address(hash))

/** The tokens the address holds now. Blockscout keeps a row for a token once held and since emptied; that is not a holding. */
export const heldTokens = cache(async (hash: string) =>
  (await get<HeldToken[]>(`/addresses/${hash}/token-balances`)).filter((h) => BigInt(h.value) > 0n),
)

export const addressLogs = (hash: string, p: PageParams) => get<Page<AddressLog>>(`/addresses/${hash}/logs`, p)

const ref = (t: Transaction): TxRef | null => (t.timestamp === null ? null : { hash: t.hash, timestamp: t.timestamp })

/** Etherscan's "Transactions Sent: Latest … First …": the newest and the oldest transaction the address sent. */
export async function sentRange(hash: string): Promise<{ latest: TxRef | null; first: TxRef | null }> {
  const [latest, first] = await Promise.all([
    get<Page<Transaction>>(`/addresses/${hash}/transactions`, { filter: 'from', items_count: 1 }),
    get<Page<Transaction>>(`/addresses/${hash}/transactions`, { filter: 'from', sort: 'block_number', order: 'asc', items_count: 1 }),
  ])
  const l = latest.items[0]
  const f = first.items[0]
  return { latest: l === undefined ? null : ref(l), first: f === undefined ? null : ref(f) }
}

interface LegacyTx {
  blockNumber: string
  timeStamp: string
  hash: string
  from: string
  to: string
  value: string
  isError: string
}

interface LegacyInternal {
  blockNumber: string
  timeStamp: string
  transactionHash: string
  from: string
  to: string
  value: string
  isError: string
}

/** A coin payment into the address, as the legacy API lists it (addresses lower-case). */
interface Payment {
  from: string
  tx: string
  timestamp: string
  block: number
}

/** "Funded By": the funder (as Blockscout knows it: checksummed, named, contract or not) and the paying transaction. */
export interface Funding {
  funder: AddressParam
  tx: TxRef
}

const FUND_SCAN = 100

/** Which of the two histories' first payments came first, or null when that cannot be told for certain. */
function firstPayment(
  tx: Payment | null,
  internal: Payment | null,
  txEnd: number | null,
  internalEnd: number | null,
): Payment | null {
  if (tx !== null && internal !== null) {
    if (tx.block !== internal.block) return tx.block < internal.block ? tx : internal
    // Same block: a transaction's own value moves before any internal call inside it; two different transactions in
    // one block cannot be ordered here (the internal list carries no transaction index).
    return tx.tx === internal.tx ? tx : null
  }
  const found = tx ?? internal
  if (found === null) return null
  // Only one history holds a payment; the other must have been read past its block (or to its end).
  const otherEnd = found === tx ? internalEnd : txEnd
  return otherEnd === null || otherEnd > found.block ? found : null
}

/**
 * Etherscan's "Funded By": the address and transaction that first sent this address coin. A payment comes either as a
 * transaction's value or as an internal call's value, so both histories are read oldest-first (FUND_SCAN rows each,
 * two legacy-API calls) and the earlier first payment wins. The answer is only given when it is certain: when one
 * history found nothing in its scanned rows and those rows end before the other's first payment, an earlier payment
 * could still lie beyond them, and the field is left out.
 */
export async function fundedBy(hash: string): Promise<Funding | null> {
  const me = hash.toLowerCase()
  const base = { module: 'account', address: hash, page: '1', offset: String(FUND_SCAN), sort: 'asc' }
  const [txs, internals] = await Promise.all([
    legacy<LegacyTx>({ ...base, action: 'txlist' }),
    legacy<LegacyInternal>({ ...base, action: 'txlistinternal' }),
  ])
  const paid = (r: { to: string; value: string; isError: string }) => r.to.toLowerCase() === me && r.isError === '0' && BigInt(r.value) > 0n
  const at = (r: { timeStamp: string; blockNumber: string; from: string }, tx: string): Payment => ({
    from: r.from,
    tx,
    timestamp: new Date(Number(r.timeStamp) * 1000).toISOString(),
    block: Number(r.blockNumber),
  })
  const tx = txs.find(paid)
  const internal = internals.find(paid)
  // The last block each history was read up to; null when it was read to its end.
  const scannedTo = (rows: { blockNumber: string }[]) => {
    const last = rows.at(-1)
    return rows.length < FUND_SCAN || last === undefined ? null : Number(last.blockNumber)
  }
  const first = firstPayment(
    tx === undefined ? null : at(tx, tx.hash),
    internal === undefined ? null : at(internal, internal.transactionHash),
    scannedTo(txs),
    scannedTo(internals),
  )
  if (first === null) return null
  const funder = await addressOf(first.from)
  return { funder, tx: { hash: first.tx, timestamp: first.timestamp } }
}

/** What the More Info card shows; each part is null when the address has none (or is not of that kind). */
export interface MoreInfo {
  creator: AddressParam | null
  creation: TxRef | null
  sent: { latest: TxRef | null; first: TxRef | null } | null
  funding: Funding | null
}

/** A contract's creator and creation transaction; a wallet's sent-transaction range and first funder. */
export async function moreInfo(a: AddressInfo): Promise<MoreInfo> {
  if (a.is_contract) {
    const [creator, creation] = await Promise.all([
      a.creator_address_hash === null ? null : addressOf(a.creator_address_hash),
      a.creation_transaction_hash === null ? null : txOf(a.creation_transaction_hash),
    ])
    return { creator, creation: creation === null ? null : ref(creation), sent: null, funding: null }
  }
  const [sent, funding] = await Promise.all([sentRange(a.hash), fundedBy(a.hash)])
  return { creator: null, creation: null, sent, funding }
}

/**
 * The input data of each transaction, by hash (one JSON-RPC batch to our node). Events show the method of the
 * transaction that emitted them. Every hash comes from Blockscout, which indexed it from this node, so a transaction
 * the node does not have is an error, not a row to leave blank.
 */
export async function txInputs(hashes: string[]): Promise<(hash: string) => string> {
  const unique = [...new Set(hashes)]
  const replies = await rpcBatch(unique.map((h) => ({ method: 'eth_getTransactionByHash', params: [h] })))
  const out = new Map<string, string>()
  replies.forEach((r, i) => {
    const h = unique[i]
    if (h === undefined) return
    if ('error' in r) throw new Error(`eth_getTransactionByHash ${h}: ${r.error}`)
    const tx = r.result as { input: string } | null
    if (tx === null) throw new Error(`eth_getTransactionByHash ${h}: the node has no such transaction`)
    out.set(h, tx.input)
  })
  return (hash) => {
    const input = out.get(hash)
    if (input === undefined) throw new Error(`txInputs: ${hash} was not among the hashes asked for`)
    return input
  }
}
