// The "Transaction Action" line: one sentence saying what a transaction did, as Etherscan puts above its details.
//
// Etherscan writes it from its own table of known contracts. Elysium has no such table, so the sentence is read
// from what the transaction itself shows, and only in shapes that cannot mislead:
// - approve(spender, amount) called on an ERC-20 token: "Approve 1.00 B ORIGO for Trade on <spender>";
// - the sender gave exactly one asset and got exactly one other back, counting the value sent, coin moved by
//   internal calls and ERC-20 transfers: "Swap 1 HYPE for 1.49 M AK on <contract called>" ("Wrap" / "Unwrap"
//   when the contract called is the token itself);
// - exactly one token transfer: "Transfer 0.0792 ORIGO to <receiver>" ("Mint" / "Burn" for the zero address);
// - any other contract call: "Call <method> Method on <contract>".
// A trade also lists the fees it paid and to whom (beyond Etherscan, which shows none): see tradeFees.
// A failed transaction moved nothing, so it only ever reads as a call.
import { api } from './api'
import { isAddress } from './format'
import { orNull } from './page'
import type { CoinMoves } from './tx-data'
import type { AddressParam, TokenInfo, TokenTransfer, Transaction } from './types'

/** An asset and an amount of it in its smallest unit; `token` null is the chain's coin. */
export interface Holding {
  token: TokenInfo | null
  amount: bigint
  decimals: number
}

const COIN_DECIMALS = 18

/**
 * A fungible transfer's decimals: the transfer's own, else the token's. Blockscout leaves both null for a token whose
 * decimals() it could not read; the amount then shows in raw units, as the transfer lists show it.
 */
export function transferDecimals(tt: TokenTransfer, own: string | null): number {
  return Number(own ?? tt.token.decimals ?? '0')
}

export type TxAction =
  | { kind: 'approve'; actor: AddressParam; token: TokenInfo; amount: bigint | 'unlimited'; spender: AddressParam }
  | { kind: 'swap' | 'wrap' | 'unwrap'; actor: AddressParam; sent: Holding; got: Holding; on: AddressParam; fees: Fee[] }
  | { kind: 'transfer' | 'mint' | 'burn'; actor: AddressParam; transfer: TokenTransfer }
  | { kind: 'call'; actor: AddressParam; method: string; on: AddressParam }

const APPROVE = '095ea7b3'
/** ArbOS's own "startBlock" transaction in every block: bookkeeping, nobody's action. */
const ARBOS_INTERNAL = 106
/** Wallets ask for 2^256-1 to mean "no limit"; anything this large never runs out in practice. */
const UNLIMITED = 2n ** 255n
const ZERO_ADDRESS = /^0x0{40}$/i
const COIN_KEY = 'coin'

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

async function approval(t: Transaction, on: AddressParam): Promise<TxAction | null> {
  const input = t.decoded_input
  if (input === null || input.method_id !== APPROVE) return null
  // The names come from a public signature database, where another function can share approve's selector; only
  // a decoding with approve's own argument types is read as one.
  const [spender, amount] = input.parameters
  if (spender === undefined || amount === undefined || input.parameters.length !== 2) return null
  if (spender.type !== 'address' || amount.type !== 'uint256') return null
  if (typeof spender.value !== 'string' || !isAddress(spender.value) || typeof amount.value !== 'string' || !/^\d+$/.test(amount.value)) return null
  // A contract that is not a token answers 404. ERC-721 shares the selector, its second argument a token id.
  const token = await orNull(api.token(on.hash))
  if (token === null || token.type !== 'ERC-20') return null
  const raw = BigInt(amount.value)
  return { kind: 'approve', actor: t.from, token, amount: raw >= UNLIMITED ? 'unlimited' : raw, spender: await api.address(spender.value) }
}

const assetKey = (token: TokenInfo | null) => (token === null ? COIN_KEY : token.address_hash.toLowerCase())

/** Per address (lower-case hash), what it gained (positive) or gave (negative) of each asset over the transaction. */
type Nets = Map<string, { address: AddressParam; assets: Map<string, Holding> }>

/**
 * Every address's net change in the coin and in ERC-20 tokens: the value sent, coin moved by internal calls and
 * fungible transfers. `nftOf` lists the addresses an NFT moved from or to (those are kept out of trades).
 */
function netChanges(t: Transaction, tokenTransfers: TokenTransfer[], moves: CoinMoves): { nets: Nets; nftOf: Set<string> } {
  const nets: Nets = new Map()
  const nftOf = new Set<string>()
  const add = (a: AddressParam, token: TokenInfo | null, decimals: number, delta: bigint) => {
    const k = a.hash.toLowerCase()
    let entry = nets.get(k)
    if (entry === undefined) {
      entry = { address: a, assets: new Map() }
      nets.set(k, entry)
    }
    const key = assetKey(token)
    const held = entry.assets.get(key)
    entry.assets.set(key, { token, decimals, amount: held === undefined ? delta : held.amount + delta })
  }
  const move = (from: AddressParam, to: AddressParam, token: TokenInfo | null, decimals: number, v: bigint) => {
    add(from, token, decimals, -v)
    add(to, token, decimals, v)
  }
  if (t.to !== null && t.value !== '0') move(t.from, t.to, null, COIN_DECIMALS, BigInt(t.value))
  for (const m of moves.items) {
    // A create call's receiver is the contract it made; a call's or selfdestruct's is `to`.
    const to = m.to !== null ? m.to : m.created_contract
    if (to !== null) move(m.from, to, null, COIN_DECIMALS, BigInt(m.value))
  }
  for (const tt of tokenTransfers) {
    const total = tt.total
    if (tt.token.type === 'ERC-20' && total !== null && 'value' in total && total.value !== null) {
      move(tt.from, tt.to, tt.token, transferDecimals(tt, total.decimals), BigInt(total.value))
    } else {
      nftOf.add(tt.from.hash.toLowerCase())
      nftOf.add(tt.to.hash.toLowerCase())
    }
  }
  return { nets, nftOf }
}

/** One fee taken from a trade: who got it, how much, and its share of the trade in hundredths of a percent. */
export interface Fee {
  to: AddressParam
  holding: Holding
  basisPoints: bigint
}

/** Share of `part` in `whole`, in hundredths of a percent, rounded half up. */
const hundredthsOfPercent = (part: bigint, whole: bigint) => (part * 10_000n * 2n + whole) / (whole * 2n)

/**
 * Fees a trade paid, on any platform: addresses that only received (gave nothing back in any asset) a share of what
 * the trader paid or got, other than the trader. A pool gives one asset for another, a pass-through contract forwards
 * what it receives, so neither counts; a token minted here is the wrapper (WHYPE takes HYPE and mints WHYPE), not a
 * fee taker. A share of what was paid is measured against the amount paid; a share of what was got against the
 * amount got plus those shares (what the trade gave out in total).
 */
function tradeFees(nets: Nets, me: string, sent: Holding, got: Holding, tokenTransfers: TokenTransfer[]): Fee[] {
  const minted = new Set(tokenTransfers.filter((tt) => ZERO_ADDRESS.test(tt.from.hash)).map((tt) => tt.token.address_hash.toLowerCase()))
  const taken: { to: AddressParam; holding: Holding; ofSent: boolean }[] = []
  for (const [k, entry] of nets) {
    if (k === me || minted.has(k)) continue
    const holdings = [...entry.assets.values()]
    if (holdings.some((h) => h.amount < 0n)) continue
    for (const [asset, ofSent] of [
      [sent, true],
      [got, false],
    ] as const) {
      const h = entry.assets.get(assetKey(asset.token))
      if (h !== undefined && h.amount > 0n) taken.push({ to: entry.address, holding: h, ofSent })
    }
  }
  const gotTotal = taken.filter((f) => !f.ofSent).reduce((sum, f) => sum + f.holding.amount, got.amount)
  return taken.map((f) => ({ to: f.to, holding: f.holding, basisPoints: hundredthsOfPercent(f.holding.amount, f.ofSent ? sent.amount : gotTotal) }))
}

function trade(t: Transaction, tokenTransfers: TokenTransfer[], moves: CoinMoves, on: AddressParam): TxAction | null {
  const me = t.from.hash.toLowerCase()
  const { nets, nftOf } = netChanges(t, tokenTransfers, moves)
  const mine = nets.get(me)
  if (mine === undefined || nftOf.has(me)) return null
  const changed = [...mine.assets.values()].filter((h) => h.amount !== 0n)
  const lost = changed.find((h) => h.amount < 0n)
  const gained = changed.find((h) => h.amount > 0n)
  if (changed.length !== 2 || lost === undefined || gained === undefined) return null
  const sent = { ...lost, amount: -lost.amount }
  const isOn = (h: Holding) => h.token !== null && same(h.token.address_hash, on.hash)
  const kind = sent.token === null && isOn(gained) ? 'wrap' : gained.token === null && isOn(sent) ? 'unwrap' : 'swap'
  return { kind, actor: t.from, sent, got: gained, on, fees: tradeFees(nets, me, sent, gained, tokenTransfers) }
}

function singleTransfer(t: Transaction, tokenTransfers: TokenTransfer[]): TxAction | null {
  const [tt] = tokenTransfers
  if (tt === undefined || tokenTransfers.length !== 1) return null
  if (ZERO_ADDRESS.test(tt.from.hash)) return { kind: 'mint', actor: t.from, transfer: tt }
  if (ZERO_ADDRESS.test(tt.to.hash)) return { kind: 'burn', actor: tt.from, transfer: tt }
  return { kind: 'transfer', actor: tt.from, transfer: tt }
}

/** The action line for `t`, or null when there is nothing to say beyond its From, To and Value rows. */
export async function txAction(t: Transaction, moves: CoinMoves): Promise<TxAction | null> {
  const on = t.to
  if (on === null || t.type === ARBOS_INTERNAL) return null
  // Blockscout lists the first 50 token transfers on the transaction; past that the totals here would be partial.
  const tokenTransfers = t.token_transfers_overflow ? null : t.token_transfers
  if (t.status === 'ok') {
    const approve = await approval(t, on)
    if (approve !== null) return approve
    if (tokenTransfers !== null) {
      const found = (moves.complete ? trade(t, tokenTransfers, moves, on) : null) ?? singleTransfer(t, tokenTransfers)
      if (found !== null) return found
    }
  }
  if (on.is_contract && t.method !== null) return { kind: 'call', actor: t.from, method: t.method, on }
  return null
}
