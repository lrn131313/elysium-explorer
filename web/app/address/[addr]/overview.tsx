import { ArrowUpRight, CircleHelp, Coins } from 'lucide-react'
import Link from 'next/link'
import { AddressLink } from '@/components/AddressLink'
import { TokenHoldings, type HoldingGroup, type HoldingRow } from '@/components/address-holdings'
import { TimeAgo } from '@/components/client'
import type { HeldToken, MoreInfo, TxRef } from '@/lib/address-api'
import { formatUnits, usd, utc } from '@/lib/format'
import { SITE } from '@/lib/site'
import type { AddressInfo } from '@/lib/types'

/** "6.6421781652213403": the exact amount, its point in bold, as Etherscan prints a balance. */
function BoldPoint({ text }: { text: string }) {
  const dot = text.indexOf('.')
  if (dot === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, dot)}
      <b>.</b>
      {text.slice(dot + 1)}
    </>
  )
}

/** Dollar worth as Etherscan's Overview prints it: "Less Than $0.01" for a dust balance. */
function worth(v: number): string {
  return v > 0 && v < 0.01 ? 'Less Than $0.01' : usd(v)
}

/** A token price: "$0.9993", at most four decimals, at least two. */
const price = (rate: string) => `$${Number(rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`

/** An age that links to its transaction ("8 yrs 325 days ago"), with the UTC time on hover. */
function TxAge({ tx, className, arrow = false }: { tx: TxRef; className?: string; arrow?: boolean }) {
  return (
    <Link href={`/tx/${tx.hash}`} className={className} title={utc(tx.timestamp)}>
      <TimeAgo ts={tx.timestamp} />
      {arrow && <ArrowUpRight size={13} className="ms-1" />}
    </Link>
  )
}

const TYPE_ORDER = ['ERC-20', 'ERC-721', 'ERC-1155', 'ERC-404']
const MAX_LISTED = 200

/** The dropdown's rows, by token standard; priced tokens first by worth, the rest by name. */
function holdingGroups(held: HeldToken[], owner: string): { groups: HoldingGroup[]; total: string | null } {
  let sum = 0
  let priced = 0
  const rows = new Map<string, { row: HoldingRow; worth: number | null }[]>()
  for (const h of held) {
    const t = h.token
    const fungible = t.type === 'ERC-20'
    // Blockscout has no decimals for NFTs and for tokens that do not answer decimals(); their amounts are whole units.
    const decimals = t.decimals === null ? 0 : Number(t.decimals)
    const value = fungible && t.exchange_rate !== null ? (Number(BigInt(h.value)) / 10 ** decimals) * Number(t.exchange_rate) : null
    if (value !== null) {
      sum += value
      priced++
    }
    // Eight decimals, as Etherscan lists them; a dust amount that would read 0 is shown in full instead.
    const short = formatUnits(h.value, decimals, { maxFraction: 8 })
    const amount = fungible
      ? `${short === '0' ? formatUnits(h.value, decimals) : short}${t.symbol === null ? '' : ` ${t.symbol}`}`
      : `${h.token_id === null ? '' : `#${h.token_id} `}x${h.value}`
    const row: HoldingRow = {
      key: `${t.address_hash}-${h.token_id === null ? '' : h.token_id}`,
      href: `/token/${t.address_hash}?a=${owner}`,
      icon: t.icon_url,
      name: t.name === null ? t.address_hash : t.name,
      symbol: t.symbol,
      amount,
      usd: value === null ? null : usd(value),
      rate: fungible && t.exchange_rate !== null ? Number(t.exchange_rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : null,
    }
    const list = rows.get(t.type)
    if (list === undefined) rows.set(t.type, [{ row, worth: value }])
    else list.push({ row, worth: value })
  }
  const rank = (type: string) => {
    const i = TYPE_ORDER.indexOf(type)
    return i === -1 ? TYPE_ORDER.length : i
  }
  const byWorth = (x: { row: HoldingRow; worth: number | null }, y: { row: HoldingRow; worth: number | null }) => {
    if (x.worth !== null && y.worth !== null) return y.worth - x.worth
    if (x.worth !== null) return -1
    if (y.worth !== null) return 1
    return x.row.name.localeCompare(y.row.name)
  }
  // At most MAX_LISTED rows per standard go to the browser (an address can hold thousands); the Assets tab lists them all.
  const groups: HoldingGroup[] = [...rows.entries()]
    .sort(([x], [y]) => rank(x) - rank(y) || x.localeCompare(y))
    .map(([type, list]) => {
      const kept = list.sort(byWorth).slice(0, MAX_LISTED)
      return { type, size: kept.length < list.length ? `>${kept.length}` : String(list.length), rows: kept.map((r) => r.row) }
    })
  // Unpriced tokens add an unknown amount on top of the priced ones: "more than", as Etherscan writes it.
  const total = priced === 0 ? null : `${priced < held.length ? '>' : ''}${usd(sum)}`
  return { groups, total }
}

/** The Overview card: coin balance and worth, and the Token Holdings dropdown when the address holds any token. */
export function OverviewCard({ a, held }: { a: AddressInfo; held: HeldToken[] }) {
  const balance = a.coin_balance === null ? '0' : a.coin_balance
  const rate = a.exchange_rate
  const { groups, total } = holdingGroups(held, a.hash)
  return (
    <div className="col-md-6 col-lg-4">
      <div className="card h-100">
        <div className="card-body address-card">
          <h3 className="address-card-title">Overview</h3>
          <div>
            <h4 className="ex-cap mb-1">{SITE.coin} Balance</h4>
            <div>
              <BoldPoint text={formatUnits(balance, 18)} /> {SITE.coin}
            </div>
          </div>
          {rate !== null && (
            <div>
              <h4 className="ex-cap mb-1">{SITE.coin} Value</h4>
              {worth((Number(BigInt(balance)) / 1e18) * Number(rate))}{' '}
              <span className="small">
                (@ {usd(Number(rate))}/{SITE.coin})
              </span>
            </div>
          )}
          {held.length > 0 && (
            <div>
              <h4 className="ex-cap mb-1">Token Holdings</h4>
              <div className="d-flex gap-2">
                <TokenHoldings total={total} count={held.length} groups={groups} allHref={`/address/${a.hash}?tab=assets`} />
                <Link href={`/address/${a.hash}?tab=assets`} className="btn btn-secondary address-coins" title="Click to see assets" aria-label="Click to see assets">
                  <Coins size={15} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** The More Info card: a contract's creator and token tracker; a wallet's sent-transaction range and first funder. */
export function MoreInfoCard({ a, info }: { a: AddressInfo; info: MoreInfo }) {
  return (
    <div className="col-md-6 col-lg-4">
      <div className="card h-100">
        <div className="card-body address-card">
          <h3 className="address-card-title">More Info</h3>
          {a.is_contract && (
            <div>
              <h4 className="ex-cap mb-1">
                <span className="d-md-none d-lg-inline-block me-1">Contract</span>Creator
              </h4>
              {info.creator === null ? (
                <div>-</div>
              ) : (
                <div className="d-flex flex-wrap align-items-center gap-1">
                  <AddressLink a={info.creator} copy />
                  {info.creation !== null && (
                    <>
                      <span className="text-muted mx-1">|</span>
                      <TxAge tx={info.creation} />
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {a.token !== null && (
            <div>
              <h4 className="ex-cap mb-1">
                <span className="d-md-none d-lg-inline-block me-1">Token</span>Tracker
              </h4>
              <div className="d-flex align-items-center gap-1">
                <Link href={`/token/${a.hash}`} className="d-flex align-items-center text-truncate" title="View Token Tracker Page">
                  {a.token.icon_url === null ? (
                    <span className="address-head-icon me-1" aria-hidden="true" />
                  ) : (
                    <img src={a.token.icon_url} width={24} height={24} className="address-head-icon me-1" alt="" />
                  )}
                  <span className="text-truncate">
                    {a.token.type}: {a.token.name === null ? a.hash : a.token.name}
                    {a.token.symbol !== null && ` (${a.token.symbol})`}
                  </span>
                </Link>
                {a.token.exchange_rate !== null && (
                  <span className="text-muted text-truncate" title={`$${a.token.exchange_rate}`}>
                    ({price(a.token.exchange_rate)})
                  </span>
                )}
              </div>
            </div>
          )}
          {a.implementations !== null && a.implementations.length > 0 && (
            <div>
              <h4 className="ex-cap mb-1">Implementation{a.proxy_type === null ? '' : ` (${a.proxy_type})`}</h4>
              {a.implementations.map((im) => (
                <div key={im.address_hash}>
                  <Link href={`/address/${im.address_hash}`}>{im.name === null ? im.address_hash : im.name}</Link>
                </div>
              ))}
            </div>
          )}
          {/* A wallet that never sent anything still gets the row, with "-", so the card is never left with only its title. */}
          {info.sent !== null && (
            <div>
              <h4 className="ex-cap mb-1">Transactions Sent</h4>
              <div className="d-flex align-items-center flex-wrap gap-1">
                {info.sent.latest === null && info.sent.first === null && <span>-</span>}
                {info.sent.latest !== null && (
                  <div>
                    <span className="text-muted">Latest:</span> <TxAge tx={info.sent.latest} className="link-dark" arrow />
                  </div>
                )}
                <span className="mx-1" />
                {info.sent.first !== null && (
                  <div>
                    <span className="text-muted">First:</span> <TxAge tx={info.sent.first} className="link-dark" arrow />
                  </div>
                )}
              </div>
            </div>
          )}
          {info.funding !== null && (
            <div>
              <h4 className="ex-cap mb-1">
                Funded By{' '}
                <span className="ex-help" title={`The address and transaction that first funded this address with ${SITE.coin}.`}>
                  <CircleHelp size={12} />
                </span>
              </h4>
              <div className="d-flex flex-wrap align-items-center gap-1">
                <AddressLink a={info.funding.funder} copy />
                <span className="text-muted mx-1">|</span>
                <TxAge tx={info.funding.tx} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
