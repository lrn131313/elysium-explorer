// What a transaction page reads beyond the transaction itself: the coin its internal calls moved.
import { api } from './api'
import { SharedCache } from './lists-cache'
import type { AddressParam, InternalTransaction, PageParams } from './types'

/**
 * Internal call types that move coin. A delegatecall or staticcall carries its caller's value without sending it,
 * and a failed call moved nothing, so neither is a transfer.
 */
const MOVES = new Set(['call', 'create', 'create2', 'selfdestruct'])

/**
 * Blockscout serves 50 calls a page, one request each. Ordinary transactions fit one page (a launchpad sell: 26
 * calls); 250 covers multi-hop routes. Past that the page says the list is cut, so anyone can make a transaction with
 * many calls but not one that makes each view of it cost more than five requests.
 */
const MAX_PAGES = 5

/**
 * Repeated views of one transaction within a minute read it once. Short, because Blockscout fetches a block's
 * internal calls after the block itself, so a fresh transaction's list can still grow.
 */
const cache = new SharedCache<CoinMoves>(60_000, 500)

export interface CoinMoves {
  /** Successful internal calls that moved coin, in call order. */
  items: InternalTransaction[]
  /** False when the transaction made more calls than were read. */
  complete: boolean
  /** Internal calls read, of any kind (the Internal Txns tab shows only when there is one). */
  calls: number
}

async function readMoves(hash: string): Promise<CoinMoves> {
  const items: InternalTransaction[] = []
  let calls = 0
  let cursor: PageParams | undefined
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await api.txInternal(hash, cursor)
    calls += page.items.length
    for (const it of page.items) if (it.success && MOVES.has(it.type) && it.value !== '0') items.push(it)
    if (page.next_page_params === null) return { items, complete: true, calls }
    cursor = page.next_page_params
  }
  return { items, complete: false, calls }
}

export function coinMoves(hash: string): Promise<CoinMoves> {
  return cache.get(hash.toLowerCase(), () => readMoves(hash))
}

/** One amount of one asset moving between two addresses; `assetKey` tells assets apart. */
export interface Move<A> {
  from: AddressParam
  to: AddressParam
  asset: A
  assetKey: string
  amount: bigint
}

/** One address's net change in one asset: positive received, negative sent. */
export interface NetLine<A> {
  address: AddressParam
  asset: A
  amount: bigint
}

/**
 * Etherscan's "Net Transfers": per address and asset, received minus sent, in the order the addresses first appear.
 * An address that only passed an amount on nets to zero and is left out.
 */
export function netLines<A>(moves: readonly Move<A>[]): NetLine<A>[] {
  const lines = new Map<string, NetLine<A>>()
  const add = (address: AddressParam, m: Move<A>, delta: bigint) => {
    const k = `${address.hash.toLowerCase()}|${m.assetKey}`
    const line = lines.get(k)
    if (line === undefined) lines.set(k, { address, asset: m.asset, amount: delta })
    else line.amount += delta
  }
  for (const m of moves) {
    add(m.from, m, -m.amount)
    add(m.to, m, m.amount)
  }
  return [...lines.values()].filter((l) => l.amount !== 0n)
}
