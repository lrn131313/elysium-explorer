import { CircleAlert, CircleHelp, Eye, Newspaper } from 'lucide-react'
import Link from 'next/link'
import type { Sheet } from '@/lib/csv'
import { api } from '@/lib/api'
import { fee8, formatUnits, listCoin, listDate, mid, tokenTabAmount, usdOf } from '@/lib/format'
import { getLabels, type Label } from '@/lib/labels'
import { gasPriceGwei, tokenUsd, type Pointed } from '@/lib/lists-format'
import { methodNames, shownMethod } from '@/lib/methods'
import { SITE } from '@/lib/site'
import type { AddressParam, InternalTransaction, TokenInfo, TokenTransfer, Transaction } from '@/lib/types'
import { AddressLink, displayName } from './AddressLink'
import { ColumnToggle, CopyButton, TimeAgo } from './client'
import { EmptyRow, FlowArrow, InOut, Method, methodLabel } from './ui'

function Addr({ a, me, href }: { a: AddressParam; me?: string; href?: string }) {
  return <AddressLink a={a} current={me} copy href={href} />
}

/** The full hash stays in the page; CSS cuts it with an ellipsis at 7rem, as on Etherscan. */
function TxHash({ hash, failed }: { hash: string; failed?: string }) {
  return (
    <span className="d-inline-flex align-items-center gap-1">
      {failed && (
        <span title={failed} className="d-inline-flex">
          <CircleAlert size={14} className="text-danger" aria-label={failed} />
        </span>
      )}
      <Link href={`/tx/${hash}`} className="ex-hash">
        {hash}
      </Link>
      <CopyButton text={hash} label="Copy Transaction Hash" />
    </span>
  )
}

function Preview({ hash }: { hash: string }) {
  return (
    <Link href={`/tx/${hash}`} className="ex-eye" aria-label="View transaction" title="See preview of the transaction details.">
      <Eye size={12} />
    </Link>
  )
}

/** A token's round logo, or a plain circle with its symbol's first letter when it has none (no token here has one yet). */
export function TokenLogo({ token, size }: { token: TokenInfo; size: 18 | 24 }) {
  if (token.icon_url !== null) return <img src={token.icon_url} width={size} height={size} className="ex-token-logo" alt="" />
  const letter = (token.symbol ?? token.name ?? '').trim().charAt(0).toUpperCase()
  return (
    <span className="ex-token-logo ex-token-logo-blank" style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }} aria-hidden="true">
      {letter === '' ? '?' : letter}
    </span>
  )
}

/** The grey (?) beside a column header, its explanation in the tooltip. */
export function Help({ tip }: { tip: string }) {
  return (
    <span title={tip} className="ex-help">
      <CircleHelp size={13} />
    </span>
  )
}

const PREVIEW_TIP = 'See preview of the transaction details.'
const ACTION_TIP = 'Function executed based on decoded input data. For unidentified functions, method ID is displayed instead.'

// ---------- switchable columns (TEAM.md §3 "Display preferences"): both variants are rendered, CSS shows one ----------

/** The blue "Age" / "Date Time (UTC)" header of every list with an Age column; `children` follow it (a help icon). */
export function AgeHead({ children }: { children?: React.ReactNode }) {
  return (
    <th className="ex-th-link">
      <ColumnToggle
        pref="age"
        first={{ value: 'age', label: 'Age', title: 'Click to show Datetime Format' }}
        second={{ value: 'datetime', label: 'Date Time (UTC)', title: 'Click to show Age Format' }}
      />
      {children}
    </th>
  )
}

/** The blue "Amount" / "Value (USD)" header; the dollar variant carries Etherscan's help icon about the rate. */
function AmountHead({ label = 'Amount' }: { label?: string }) {
  return (
    <th className="ex-th-link">
      <ColumnToggle pref="amount" first={{ value: 'amount', label }} second={{ value: 'usd', label: 'Value (USD)' }} />
      <span className="ex-v-usd ms-1">
        <Help tip="Value displayed based on latest available exchange rate." />
      </span>
    </th>
  )
}

/** The blue "Txn Fee" / "Gas Price" header of transaction lists. */
function FeeHead() {
  return (
    <th className="ex-th-link">
      <ColumnToggle
        pref="fee"
        first={{ value: 'fee', label: 'Txn Fee', title: `(Gas Price * Gas Used by Txns) in ${SITE.coin}` }}
        second={{ value: 'gasprice', label: 'Gas Price', title: 'Gas Price in Gwei' }}
      />
    </th>
  )
}

/** Age cell: live relative time with the UTC date on hover, or (switched) the UTC date itself. */
export function AgeCell({ ts }: { ts: string }) {
  const date = listDate(ts)
  return (
    <>
      <span className="ex-v-age" title={date}>
        <TimeAgo ts={ts} />
      </span>
      <span className="ex-v-datetime">{date}</span>
    </>
  )
}

/** "0<b>.</b>00000234": Etherscan bolds the decimal point of fees and gas prices. */
function Point({ n }: { n: Pointed }) {
  return n.frac === null ? (
    <>{n.int}</>
  ) : (
    <>
      {n.int}
      <b>.</b>
      {n.frac}
    </>
  )
}

/** Txn Fee (8 decimals of the coin) or, switched, Gas Price (Gwei); muted and small via the cell. */
function FeeCell({ fee, gasPrice }: { fee: string | null; gasPrice: string | null }) {
  return (
    <>
      <span className="ex-v-fee">{fee === null ? '-' : <Point n={fee8(fee)} />}</span>
      <span className="ex-v-gasprice">{gasPrice === null ? '-' : <Point n={gasPriceGwei(gasPrice)} />}</span>
    </>
  )
}

/** Coin amount "0.006009159 HYPE" (exact value and dollar worth on hover), or switched, its dollar worth at `rate`. */
function CoinAmount({ wei, rate }: { wei: string; rate: string | null }) {
  const usd = usdOf(wei, rate)
  return (
    <>
      <span className="ex-v-amount" title={`${formatUnits(wei, 18)} ${SITE.coin}${usd ? ` | ${usd}` : ''}`}>{`${listCoin(wei)} ${SITE.coin}`}</span>
      <span className="ex-v-usd">{usd === null ? '-' : usd}</span>
    </>
  )
}

/** "Contract Creation" in the To column, linking to the contract the call created. */
function Created({ a }: { a: AddressParam }) {
  return (
    <Link href={`/address/${a.hash}`} className="d-inline-flex align-items-center gap-1 link-dark" title={a.hash}>
      <Newspaper size={13} className="ex-contract-icon" aria-hidden="true" />
      Contract Creation
    </Link>
  )
}

/** A contract creation has no method; Etherscan shows the first 4 bytes of its init code ("0x60806040") instead. */
function txMethod(t: Transaction, names: ReadonlyMap<string, string>): string | null {
  if (t.method === null && t.created_contract !== null) return t.raw_input.slice(0, 10)
  return shownMethod(t.method, names)
}

// ---------- "Download Page Data" sheets: the same texts as the tables, as plain cells ----------

const txStatus = (s: Transaction['status']) => (s === 'ok' ? 'Success' : s === 'error' ? 'Failed' : 'Pending')

function sheetName(kind: string, scope: string | undefined, page: number): string {
  return `export-${kind}-${scope === undefined ? 'all' : scope}-page${page}.csv`
}

/** Name tag cell: the address's shown name, or empty. */
function tag(a: AddressParam, labels: ReadonlyMap<string, Label>): string {
  const name = displayName(a, labels)
  return name === null ? '' : name
}

/** Etherscan's Transactions CSV columns, for the rows of a TxTable. */
export async function txSheet(txs: Transaction[], scope: string | undefined, page: number): Promise<Sheet> {
  const [names, labels] = await Promise.all([methodNames(txs.map((t) => t.method)), getLabels()])
  return {
    name: sheetName('txs', scope, page),
    header: ['Transaction Hash', 'Status', 'Method', 'Blockno', 'DateTime (UTC)', 'From', 'From_Nametag', 'To', 'To_Nametag', 'Amount', 'Value (USD)', 'Txn Fee'],
    rows: txs.map((t) => {
      const method = txMethod(t, names)
      const usd = usdOf(t.value, t.exchange_rate)
      const to = t.to !== null ? [t.to.hash, tag(t.to, labels)] : t.created_contract !== null ? [t.created_contract.hash, 'Contract Creation'] : ['', '']
      return [
        t.hash,
        txStatus(t.status),
        method === null ? 'Transfer' : methodLabel(method),
        t.block_number === null ? '' : String(t.block_number),
        t.timestamp === null ? '' : listDate(t.timestamp),
        t.from.hash,
        tag(t.from, labels),
        ...to,
        `${formatUnits(t.value, 18)} ${SITE.coin}`,
        usd === null ? '' : usd,
        t.fee.value === null ? '' : formatUnits(t.fee.value, 18),
      ]
    }),
  }
}

/** The rows of an InternalTable. */
export async function internalSheet(items: InternalTransaction[], scope: string | undefined, page: number): Promise<Sheet> {
  const labels = await getLabels()
  return {
    name: sheetName('internal', scope, page),
    header: ['Parent Transaction Hash', 'Blockno', 'DateTime (UTC)', 'Type', 'From', 'From_Nametag', 'To', 'To_Nametag', 'Amount', 'Status'],
    rows: items.map((it) => {
      const to = it.to !== null ? [it.to.hash, tag(it.to, labels)] : it.created_contract !== null ? [it.created_contract.hash, 'Contract Creation'] : ['', '']
      return [
        it.transaction_hash,
        String(it.block_number),
        listDate(it.timestamp),
        it.type,
        it.from.hash,
        tag(it.from, labels),
        ...to,
        `${formatUnits(it.value, 18)} ${SITE.coin}`,
        it.success ? 'Success' : it.error === null ? 'Failed' : `Failed: ${it.error}`,
      ]
    }),
  }
}

/** The rows of a TokenTransferTable, with the exact amounts. */
export async function tokenTransferSheet(items: TokenTransfer[], scope: string | undefined, page: number): Promise<Sheet> {
  const [names, labels] = await Promise.all([methodNames(items.map((t) => t.method)), getLabels()])
  return {
    name: sheetName('tokentxns', scope, page),
    header: ['Transaction Hash', 'Method', 'Blockno', 'DateTime (UTC)', 'From', 'From_Nametag', 'To', 'To_Nametag', 'Amount', 'Token', 'Token Symbol', 'Token Contract'],
    rows: items.map((t) => {
      const method = shownMethod(t.method, names)
      const amount = tokenAmount(t)
      return [
        t.transaction_hash,
        method === null ? 'Transfer' : methodLabel(method),
        String(t.block_number),
        t.timestamp === null ? '' : listDate(t.timestamp),
        t.from.hash,
        tag(t.from, labels),
        t.to.hash,
        tag(t.to, labels),
        // The table shows "-" for a transfer with no amount; a spreadsheet cell stays empty.
        amount === '-' ? '' : amount,
        t.token.name === null ? '' : t.token.name,
        t.token.symbol === null ? '' : t.token.symbol,
        t.token.address_hash,
      ]
    }),
  }
}

export async function TxTable({ txs, me }: { txs: Transaction[]; me?: string }) {
  const names = await methodNames(txs.map((t) => t.method))
  return (
    <div className="ex-table-wrap">
      <table className="ex-table">
        <thead>
          <tr>
            <th className="ex-th-icon">
              <Help tip={PREVIEW_TIP} />
            </th>
            <th>Transaction Hash</th>
            <th className="ex-th-link">
              Action <Help tip={ACTION_TIP} />
            </th>
            <th>Block</th>
            <AgeHead />
            <th>From</th>
            <th className="ex-th-badge" />
            <th>To</th>
            <AmountHead />
            <FeeHead />
          </tr>
        </thead>
        <tbody>
          {txs.length === 0 && <EmptyRow cols={10} />}
          {txs.map((t) => (
            <tr key={t.hash}>
              <td>
                <Preview hash={t.hash} />
              </td>
              <td>
                <TxHash hash={t.hash} failed={t.status === 'error' ? 'Failed' : undefined} />
              </td>
              <td>
                <Method name={txMethod(t, names)} />
              </td>
              <td>{t.block_number !== null ? <Link href={`/block/${t.block_number}`}>{t.block_number}</Link> : <span className="text-muted fst-italic">(pending)</span>}</td>
              <td>{t.timestamp && <AgeCell ts={t.timestamp} />}</td>
              <td>
                <Addr a={t.from} me={me} />
              </td>
              <td className="text-center">{me ? <InOut from={t.from.hash} to={t.to?.hash ?? null} me={me} /> : <FlowArrow />}</td>
              <td>{t.to ? <Addr a={t.to} me={me} /> : t.created_contract ? <Created a={t.created_contract} /> : '-'}</td>
              <td>
                <CoinAmount wei={t.value} rate={t.exchange_rate} />
              </td>
              <td className="ex-fee">
                <FeeCell fee={t.fee.value} gasPrice={t.gas_price} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const failedTip = (it: InternalTransaction) => (it.success ? undefined : `Failed${it.error ? `: ${it.error}` : ''}`)

function CallType({ it }: { it: InternalTransaction }) {
  return (
    <span className={`ex-badge${it.success ? '' : ' ex-badge-danger'}`} title={it.error ?? undefined}>
      {it.type}
      {!it.success && ' (failed)'}
    </span>
  )
}

/**
 * Internal calls, in Etherscan's three layouts:
 * - 'address' (an address's tab): Parent Transaction Hash, Block, Age, From, →, To, Amount.
 * - 'tx' (a transaction's tab, whose parent is the page itself): Type instead of the parent hash.
 * - 'global' (/txsInternal): Block, Age, Parent Transaction Hash, Type, From, →, To, Value. Etherscan also has a
 *   Method column there; Blockscout's internal-call items carry no method, so it is left out.
 */
export async function InternalTable({ items, me, variant = 'address' }: { items: InternalTransaction[]; me?: string; variant?: 'address' | 'tx' | 'global' }) {
  const global = variant === 'global'
  // Internal-call items carry no exchange rate; the Value (USD) variant uses the coin's latest price, as Etherscan's does.
  const rate = items.length === 0 ? null : (await api.stats()).coin_price
  return (
    <div className="ex-table-wrap">
      <table className="ex-table">
        <thead>
          <tr>
            {variant === 'address' && <th>Parent Transaction Hash</th>}
            {variant === 'tx' && <th>Type</th>}
            <th>Block</th>
            <AgeHead />
            {global && <th>Parent Transaction Hash</th>}
            {global && <th>Type</th>}
            <th>From</th>
            <th className="ex-th-badge" />
            <th>To</th>
            <AmountHead label={global ? 'Value' : 'Amount'} />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && <EmptyRow cols={global ? 8 : 7} />}
          {items.map((it) => (
            <tr key={`${it.transaction_hash}-${it.index}`}>
              {variant === 'address' && (
                <td>
                  <TxHash hash={it.transaction_hash} failed={failedTip(it)} />
                </td>
              )}
              {variant === 'tx' && (
                <td>
                  <CallType it={it} />
                </td>
              )}
              <td>
                <Link href={`/block/${it.block_number}`}>{it.block_number}</Link>
              </td>
              <td>
                <AgeCell ts={it.timestamp} />
              </td>
              {global && (
                <td>
                  <TxHash hash={it.transaction_hash} failed={failedTip(it)} />
                </td>
              )}
              {global && (
                <td>
                  <CallType it={it} />
                </td>
              )}
              <td>
                <Addr a={it.from} me={me} />
              </td>
              <td className="text-center">
                <FlowArrow />
              </td>
              <td>{it.to ? <Addr a={it.to} me={me} /> : it.created_contract ? <Created a={it.created_contract} /> : '-'}</td>
              <td>
                <CoinAmount wei={it.value} rate={rate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * A transfer's amount: "1,234.5" for fungible tokens (exact, or by size on a token's own page), "#42" for an
 * NFT, "3 of #42" for an ERC-1155 item. `bySize` applies the token page's rounding (lib/format tokenTabAmount).
 */
export function tokenAmount(t: TokenTransfer, bySize = false): string {
  const total = t.total
  if (total === null) return '-'
  const id = 'token_id' in total && total.token_id !== null ? `#${total.token_id}` : null
  if (!('value' in total) || total.value === null) return id ?? '-'
  const dec = Number(total.decimals ?? t.token.decimals ?? '0')
  const amount = bySize ? tokenTabAmount(total.value, dec) : formatUnits(total.value, dec)
  return id ? `${amount} of ${id}` : amount
}

/** The exact amount for the hover tip ("" for NFTs, whose cell already shows everything). */
function exactAmount(t: TokenTransfer): string {
  const total = t.total
  if (total === null || !('value' in total) || total.value === null) return ''
  return formatUnits(total.value, Number(total.decimals ?? t.token.decimals ?? '0'))
}

/** The Value (USD) variant: the amount at the token's latest price, "-" when the token has no price (most here). */
function transferUsd(t: TokenTransfer): string {
  const total = t.total
  if (total === null || !('value' in total) || total.value === null) return '-'
  const usd = tokenUsd(total.value, Number(total.decimals ?? t.token.decimals ?? '0'), t.token.exchange_rate)
  return usd === null ? '-' : usd
}

/**
 * Token transfers. On a token's own page (`tokenPage` set) the Token column is dropped, amounts round by size and
 * counterparties link to the token filtered by that address, as Etherscan does; on an address page `me` turns
 * the arrow into IN/OUT and the Token cell links to that token filtered by `me`.
 */
export async function TokenTransferTable({ items, me, tokenPage }: { items: TokenTransfer[]; me?: string; tokenPage?: string }) {
  const names = await methodNames(items.map((t) => t.method))
  const cols = tokenPage ? 9 : 10
  const party = (a: AddressParam) => (tokenPage ? `/token/${tokenPage}?a=${a.hash}` : undefined)
  return (
    <div className="ex-table-wrap">
      <table className="ex-table">
        <thead>
          <tr>
            <th className="ex-th-icon">
              <Help tip={PREVIEW_TIP} />
            </th>
            <th>Transaction Hash</th>
            <th className="ex-th-link">
              Action <Help tip={ACTION_TIP} />
            </th>
            <th>Block</th>
            <AgeHead />
            <th>From</th>
            <th className="ex-th-badge" />
            <th>To</th>
            <AmountHead />
            {!tokenPage && <th>Token</th>}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && <EmptyRow cols={cols} />}
          {items.map((t) => (
            <tr key={`${t.transaction_hash}-${t.log_index}`}>
              <td>
                <Preview hash={t.transaction_hash} />
              </td>
              <td>
                <TxHash hash={t.transaction_hash} />
              </td>
              <td>
                <Method name={shownMethod(t.method, names)} />
              </td>
              <td>
                <Link href={`/block/${t.block_number}`}>{t.block_number}</Link>
              </td>
              <td>{t.timestamp && <AgeCell ts={t.timestamp} />}</td>
              <td>
                <Addr a={t.from} me={me} href={party(t.from)} />
              </td>
              <td className="text-center">{me ? <InOut from={t.from.hash} to={t.to.hash} me={me} /> : <FlowArrow />}</td>
              <td>
                <Addr a={t.to} me={me} href={party(t.to)} />
              </td>
              <td>
                <span className="ex-v-amount" title={exactAmount(t) || undefined}>
                  {tokenAmount(t, tokenPage !== undefined)}
                </span>
                <span className="ex-v-usd">{transferUsd(t)}</span>
              </td>
              {!tokenPage && (
                <td>
                  <Link
                    href={me ? `/token/${t.token.address_hash}?a=${me}` : `/token/${t.token.address_hash}`}
                    className="link-dark d-inline-flex align-items-center gap-1"
                    title={t.token.name ?? t.token.address_hash}
                    data-hl={t.token.address_hash.toLowerCase()}
                  >
                    <TokenLogo token={t.token} size={18} />
                    <span className="ex-token-name">{t.token.name ?? mid(t.token.address_hash)}</span>
                    {t.token.symbol && <span className="text-muted">({t.token.symbol})</span>}
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
