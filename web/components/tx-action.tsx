import { ArrowLeftRight, ArrowRight, FileCode, Flame, Plus, Zap } from 'lucide-react'
import Link from 'next/link'
import { actionAmount, formatUnits, mid } from '@/lib/format'
import { SITE } from '@/lib/site'
import { transferDecimals, type Fee, type Holding, type TxAction } from '@/lib/tx-action'
import type { TokenInfo, TokenTransfer } from '@/lib/types'
import { AddressLink } from './AddressLink'
import { TokenLogo, tokenAmount } from './tables'
import { methodLabel } from './ui'

const ICONS = {
  approve: Zap,
  swap: ArrowLeftRight,
  wrap: ArrowLeftRight,
  unwrap: ArrowLeftRight,
  transfer: ArrowRight,
  mint: Plus,
  burn: Flame,
  call: FileCode,
} as const

/** A short amount ("1.49 M"), the exact one on hover. */
function Amount({ raw, decimals }: { raw: bigint; decimals: number }) {
  return <span title={formatUnits(raw, decimals)}>{actionAmount(raw, decimals)}</span>
}

/** The coin's symbol, or a token's logo and symbol linking to its page. */
function Asset({ token }: { token: TokenInfo | null }) {
  if (token === null) return <span>{SITE.coin}</span>
  return (
    <Link href={`/token/${token.address_hash}`} className="d-inline-flex align-items-center gap-1" title={token.name ?? token.address_hash} data-hl={token.address_hash.toLowerCase()}>
      <TokenLogo token={token} size={18} />
      {token.symbol ?? token.name ?? mid(token.address_hash)}
    </Link>
  )
}

function HoldingText({ h }: { h: Holding }) {
  return (
    <>
      <Amount raw={h.amount} decimals={h.decimals} />
      <Asset token={h.token} />
    </>
  )
}

/** A transfer's amount: short for a fungible token, "#42" / "3 of #42" for an NFT. */
function TransferAmount({ tt }: { tt: TokenTransfer }) {
  const total = tt.total
  if (total !== null && 'value' in total && total.value !== null && !('token_id' in total)) {
    return <Amount raw={BigInt(total.value)} decimals={transferDecimals(tt, total.decimals)} />
  }
  return <span>{tokenAmount(tt)}</span>
}

function Line({ action }: { action: TxAction }) {
  switch (action.kind) {
    case 'approve':
      return (
        <>
          <span>Approve</span>
          {action.amount === 'unlimited' ? <span>Unlimited</span> : <Amount raw={action.amount} decimals={Number(action.token.decimals ?? '0')} />}
          <Asset token={action.token} />
          <span>for Trade on</span>
          <AddressLink a={action.spender} />
        </>
      )
    case 'swap':
    case 'wrap':
    case 'unwrap':
      return (
        <>
          <span>{action.kind === 'swap' ? 'Swap' : action.kind === 'wrap' ? 'Wrap' : 'Unwrap'}</span>
          <HoldingText h={action.sent} />
          <span>for</span>
          <HoldingText h={action.got} />
          {action.kind === 'swap' && (
            <>
              <span>on</span>
              <AddressLink a={action.on} />
            </>
          )}
        </>
      )
    case 'transfer':
    case 'mint':
      return (
        <>
          <span>{action.kind === 'transfer' ? 'Transfer' : 'Mint'}</span>
          <TransferAmount tt={action.transfer} />
          <Asset token={action.transfer.token} />
          <span>to</span>
          <AddressLink a={action.transfer.to} />
        </>
      )
    case 'burn':
      return (
        <>
          <span>Burn</span>
          <TransferAmount tt={action.transfer} />
          <Asset token={action.transfer.token} />
        </>
      )
    case 'call':
      return (
        <>
          <span>Call</span>
          <span className="ex-action-method" title={action.method}>
            {methodLabel(action.method)}
          </span>
          <span>Method on</span>
          <AddressLink a={action.on} />
        </>
      )
  }
}

/** Hundredths of a percent as "2%", "0.5%", "1.25%". */
function percent(hundredths: bigint): string {
  const whole = hundredths / 100n
  const frac = (hundredths % 100n).toString().padStart(2, '0').replace(/0+$/, '')
  return `${whole}${frac ? '.' + frac : ''}%`
}

const assetOf = (f: Fee) => (f.holding.token === null ? '' : f.holding.token.address_hash.toLowerCase())

/** "Fees: 3% · 2% (0.0698 HYPE) to A · 1% (0.0349 HYPE) to B"; the total only when all were taken in one asset. */
function Fees({ fees }: { fees: Fee[] }) {
  const first = fees[0]
  if (first === undefined) return null
  const oneAsset = fees.every((f) => assetOf(f) === assetOf(first))
  return (
    <div className="ex-action-line ex-action-fees">
      <span className="ex-action-fees-label">Fees{oneAsset ? ` ${percent(fees.reduce((s, f) => s + f.basisPoints, 0n))}` : ''}:</span>
      {fees.map((f, i) => (
        <span key={`${f.to.hash}-${assetOf(f)}`} className="d-inline-flex flex-wrap align-items-center gap-1">
          {i > 0 && <span className="text-muted">·</span>}
          <span>{percent(f.basisPoints)}</span>
          <span className="text-muted">
            (<Amount raw={f.holding.amount} decimals={f.holding.decimals} /> {f.holding.token === null ? SITE.coin : (f.holding.token.symbol ?? mid(f.holding.token.address_hash))})
          </span>
          <span>to</span>
          <AddressLink a={f.to} />
        </span>
      ))}
    </div>
  )
}

/** Etherscan's "TRANSACTION ACTION" card above a transaction's details: who did what, with the amounts. */
export function ActionCard({ action }: { action: TxAction }) {
  const Icon = ICONS[action.kind]
  return (
    <div className="card mb-3">
      <div className="ex-action">
        <span className="ex-action-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div className="ex-action-text">
          <div className="ex-action-title">Transaction Action</div>
          <div className="ex-action-line">
            <AddressLink a={action.actor} />
            <Line action={action} />
          </div>
          {(action.kind === 'swap' || action.kind === 'wrap' || action.kind === 'unwrap') && <Fees fees={action.fees} />}
        </div>
      </div>
    </div>
  )
}
