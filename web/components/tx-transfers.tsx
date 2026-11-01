// A transaction's transfers on its Overview, as robin.etherscan.io/tx shows them (2026-11-01 screenshots):
// "Internal Transactions" (coin moved by contract calls) and "ERC-20 Tokens Transferred: (2)", each with the
// "All Transfers / Net Transfers" switch.
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { coin, formatUnits, mid, usdOf } from '@/lib/format'
import { tokenUsd } from '@/lib/lists-format'
import { SITE } from '@/lib/site'
import { transferDecimals } from '@/lib/tx-action'
import { netLines, type CoinMoves, type Move, type NetLine } from '@/lib/tx-data'
import type { TokenInfo, TokenTransfer } from '@/lib/types'
import { AddressLink } from './AddressLink'
import { TokenLogo, tokenAmount } from './tables'
import { TransferViews } from './tx-client'
import { Hr, Row } from './ui'

function Caret() {
  return <ChevronRight size={12} className="ex-tline-caret" aria-hidden="true" />
}

/** "(\$89.86)" beside an amount, nothing when there is no price. */
function UsdNote({ value }: { value: string | null }) {
  return value === null ? null : <span className="text-muted">({value})</span>
}

/** A net change: green "+1.5" received, red "-1.5" sent. */
function Signed({ amount, decimals }: { amount: bigint; decimals: number }) {
  const received = amount > 0n
  return <span className={received ? 'ex-net-in' : 'ex-net-out'}>{`${received ? '+' : ''}${formatUnits(amount, decimals)}`}</span>
}

/** The token name as Etherscan links it ("ERC-20: Origo (ORIGO)"). */
function TokenRef({ token }: { token: TokenInfo }) {
  return (
    <span className="d-inline-flex align-items-center gap-1">
      <TokenLogo token={token} size={18} />
      <Link href={`/token/${token.address_hash}`} data-hl={token.address_hash.toLowerCase()}>
        {token.type}: {token.name ?? mid(token.address_hash)}
      </Link>
      {token.symbol && <span className="text-muted">({token.symbol})</span>}
    </span>
  )
}

function NetList<A>({ lines, render }: { lines: NetLine<A>[]; render: (l: NetLine<A>) => React.ReactNode }) {
  if (lines.length === 0) return <div className="text-muted">Every address passed on what it received.</div>
  return (
    <ul className="ex-tlist">
      {lines.map((l) => (
        <li key={`${l.address.hash}-${String(l.asset)}`}>
          <Caret />
          <AddressLink a={l.address} copy />
          {render(l)}
        </li>
      ))}
    </ul>
  )
}

/** Coin moved by the transaction's internal calls; nothing when none moved any. */
export function InternalTransfers({ moves, rate, hash }: { moves: CoinMoves; rate: string | null; hash: string }) {
  // A successful value-moving call always has a receiver: `to`, or for a create the contract it made.
  const flows: Move<null>[] = moves.items.flatMap((m) => {
    const to = m.to !== null ? m.to : m.created_contract
    return to === null ? [] : [{ from: m.from, to, asset: null, assetKey: 'coin', amount: BigInt(m.value) }]
  })
  if (flows.length === 0) return null
  const all = (
    <ul className="ex-tlist">
      {flows.map((f, i) => (
        <li key={i}>
          <Caret />
          <span className="fw-medium">Transfer</span>
          <span>{coin(f.amount)}</span>
          <UsdNote value={usdOf(f.amount, rate)} />
          <span className="fw-medium">From</span>
          <AddressLink a={f.from} copy />
          <span className="fw-medium">To</span>
          <AddressLink a={f.to} copy />
        </li>
      ))}
    </ul>
  )
  const net = (
    <NetList
      lines={netLines(flows)}
      render={(l) => (
        <>
          <Signed amount={l.amount} decimals={18} />
          <span>{SITE.coin}</span>
          <UsdNote value={usdOf(l.amount < 0n ? -l.amount : l.amount, rate)} />
        </>
      )}
    />
  )
  return (
    <>
      <Hr />
      <Row label="Internal Transactions" help={`${SITE.coin} moved by the contracts this transaction called.`}>
        <TransferViews all={all} net={net} />
        {!moves.complete && (
          <div className="text-muted mt-2">
            Transfers from the first {moves.calls} internal calls. <Link href={`/tx/${hash}?tab=internal`}>See all internal transactions</Link>
          </div>
        )}
      </Row>
    </>
  )
}

/** Etherscan's order of the token sections; other types follow in the order they appear. */
const TYPE_ORDER = ['ERC-20', 'ERC-721', 'ERC-1155', 'ERC-404']

function groupByType(transfers: TokenTransfer[]): [string, TokenTransfer[]][] {
  const groups = new Map<string, TokenTransfer[]>()
  for (const t of TYPE_ORDER) groups.set(t, [])
  for (const tt of transfers) {
    const group = groups.get(tt.token.type)
    if (group === undefined) groups.set(tt.token.type, [tt])
    else group.push(tt)
  }
  return [...groups].filter(([, list]) => list.length > 0)
}

/** A fungible transfer's raw amount and decimals; null for an NFT. */
function fungible(tt: TokenTransfer): { raw: bigint; decimals: number } | null {
  const total = tt.total
  if (total === null || !('value' in total) || total.value === null || 'token_id' in total) return null
  return { raw: BigInt(total.value), decimals: transferDecimals(tt, total.decimals) }
}

function transferUsd(tt: TokenTransfer): string | null {
  const f = fungible(tt)
  return f === null ? null : tokenUsd(f.raw.toString(), f.decimals, tt.token.exchange_rate)
}

function TokenList({ transfers }: { transfers: TokenTransfer[] }) {
  return (
    <ul className="ex-tlist">
      {transfers.map((tt) => (
        <li key={tt.log_index}>
          <Caret />
          <span className="fw-medium">From</span>
          <AddressLink a={tt.from} copy />
          <span className="fw-medium">To</span>
          <AddressLink a={tt.to} copy />
          <span className="fw-medium">For</span>
          <span>{tokenAmount(tt)}</span>
          <UsdNote value={transferUsd(tt)} />
          <TokenRef token={tt.token} />
        </li>
      ))}
    </ul>
  )
}

function tokenNet(transfers: TokenTransfer[]): NetLine<{ token: TokenInfo; decimals: number }>[] {
  return netLines(
    transfers.flatMap((tt) => {
      const f = fungible(tt)
      if (f === null) return []
      const asset = { token: tt.token, decimals: f.decimals }
      const move: Move<typeof asset> = { from: tt.from, to: tt.to, asset, assetKey: tt.token.address_hash.toLowerCase(), amount: f.raw }
      return [move]
    }),
  )
}

/**
 * "ERC-20 Tokens Transferred: (2)" and one such section per NFT standard. Blockscout puts the first 50 transfers on
 * the transaction (`overflow` when there are more); the count then reads "50+".
 */
export function TokenTransfers({ transfers, overflow }: { transfers: TokenTransfer[]; overflow: boolean }) {
  return (
    <>
      {groupByType(transfers).map(([type, list]) => {
        const count = `${list.length}${overflow ? '+' : ''}`
        const badge = list.length > 1 || overflow ? <span className="ex-count-badge">{count}</span> : null
        return (
          <div key={type}>
            <Hr />
            <Row label={`${type} Tokens Transferred`} help={`${type} token movements in this transaction.`} after={badge}>
              {type === 'ERC-20' ? (
                <TransferViews
                  all={<TokenList transfers={list} />}
                  net={
                    <NetList
                      lines={tokenNet(list)}
                      render={(l) => (
                        <>
                          <Signed amount={l.amount} decimals={l.asset.decimals} />
                          <TokenRef token={l.asset.token} />
                        </>
                      )}
                    />
                  }
                />
              ) : (
                <TokenList transfers={list} />
              )}
              {overflow && <div className="text-muted mt-2">Showing the first {list.length} transfers.</div>}
            </Row>
          </div>
        )
      })}
    </>
  )
}
