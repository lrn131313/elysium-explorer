import { Search } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ListFoot, ListHead } from '@/components/list'
import { EmptyRow } from '@/components/ui'
import { heldTokens, type HeldToken } from '@/lib/address-api'
import { formatUnits, num, usd } from '@/lib/format'
import { one, type SP } from '@/lib/page'
import { jumpNav, pageFrom, pageSizeFrom } from '@/lib/paging'
import { SITE } from '@/lib/site'
import type { AddressInfo } from '@/lib/types'

const DEFAULT_SIZE = 10 // Etherscan's Assets tab: "Show rows: 10"

/** Blockscout has no decimals for NFTs and for tokens that do not answer decimals(); their amounts are whole units. */
const decimalsOf = (h: HeldToken) => (h.token.decimals === null ? 0 : Number(h.token.decimals))

/** A held token's dollar worth, when the token has a price. Float: an estimate shown beside the exact amount. */
function worthOf(h: HeldToken): number | null {
  if (h.token.exchange_rate === null) return null
  return (Number(BigInt(h.value)) / 10 ** decimalsOf(h)) * Number(h.token.exchange_rate)
}

const label = (h: HeldToken) => (h.token.name === null ? h.token.address_hash : h.token.name)

function byWorth(x: HeldToken, y: HeldToken): number {
  const wx = worthOf(x)
  const wy = worthOf(y)
  if (wx !== null && wy !== null) return wy - wx
  if (wx !== null) return -1
  if (wy !== null) return 1
  return label(x).localeCompare(label(y))
}

function matches(h: HeldToken, q: string): boolean {
  const t = h.token
  return [t.name, t.symbol, t.address_hash].some((s) => s !== null && s.toLowerCase().includes(q))
}

/** "Search Token Name / Address": a plain GET form, so it works before the page's scripts load. */
function SearchForm({ hash, view, q }: { hash: string; view: 'tokens' | 'nft'; q: string }) {
  return (
    <form action={`/address/${hash}`} method="get" className="address-search" role="search">
      <input type="hidden" name="tab" value="assets" />
      {view === 'nft' && <input type="hidden" name="view" value="nft" />}
      <Search size={14} className="address-search-icon" aria-hidden="true" />
      <input type="search" name="q" defaultValue={q} className="form-control form-control-sm" placeholder="Search Token Name / Address" aria-label="Search Token Name / Address" />
    </form>
  )
}

/**
 * The Assets tab on one chain: net worth (coin plus priced tokens), then the held tokens, paged by number (the whole
 * list comes in one call, so every page and the total are exact). "Tokens" are ERC-20s; "NFTs" are the other standards.
 */
export async function AssetsTab({ a, sp }: { a: AddressInfo; sp: SP }) {
  const rawView = one(sp, 'view')
  if (rawView !== undefined && rawView !== 'nft') notFound()
  const view = rawView === 'nft' ? 'nft' : 'tokens'
  const rawQ = one(sp, 'q')
  const q = rawQ === undefined ? '' : rawQ.trim()
  const size = pageSizeFrom(sp, DEFAULT_SIZE)
  const page = pageFrom(sp)

  const held = await heldTokens(a.hash)
  const fungible = held.filter((h) => h.token.type === 'ERC-20')
  const nfts = held.filter((h) => h.token.type !== 'ERC-20')
  const list = (view === 'nft' ? nfts : fungible).filter((h) => q === '' || matches(h, q.toLowerCase())).sort(byWorth)
  const pages = Math.max(1, Math.ceil(list.length / size))
  if (page > pages) notFound()
  const rows = list.slice((page - 1) * size, page * size)

  const keep: Record<string, string> = { tab: 'assets' }
  if (view === 'nft') keep.view = 'nft'
  if (q !== '') keep.q = q
  const nav = jumpNav({ base: `/address/${a.hash}`, keep, size, defaultSize: DEFAULT_SIZE, total: list.length, page, hasNext: page < pages })

  const balance = a.coin_balance === null ? '0' : a.coin_balance
  const rate = a.exchange_rate
  const coinUsd = rate === null ? null : (Number(BigInt(balance)) / 1e18) * Number(rate)
  const pricedTokens = fungible.map(worthOf).filter((w): w is number => w !== null)
  const tokensUsd = pricedTokens.reduce((s, w) => s + w, 0)
  // The listed tokens' worth counts priced tokens only: none priced means no worth to state; some unpriced means "more than".
  const listPriced = list.map(worthOf).filter((w): w is number => w !== null)
  const listWorth =
    listPriced.length === 0 ? null : `${listPriced.length < list.length ? '>' : ''}${usd(listPriced.reduce((s, w) => s + w, 0))}`
  // In coin terms: the exact balance while no token has a price; with priced tokens, their worth converted at the coin price.
  const netCoin =
    rate === null || pricedTokens.length === 0
      ? formatUnits(balance, 18)
      : (Number(BigInt(balance)) / 1e18 + tokensUsd / Number(rate)).toLocaleString('en-US', { maximumFractionDigits: 6 })

  const tab = (v: 'tokens' | 'nft') => `/address/${a.hash}?tab=assets${v === 'nft' ? '&view=nft' : ''}`

  return (
    <div className="card mb-3">
      <div className="card-body address-assets">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div className="ex-segment" role="tablist">
            <Link href={tab('tokens')} className={`ex-segment-item${view === 'tokens' ? ' active' : ''}`} role="tab" aria-selected={view === 'tokens'} scroll={false}>
              Tokens
            </Link>
            <Link href={tab('nft')} className={`ex-segment-item${view === 'nft' ? ' active' : ''}`} role="tab" aria-selected={view === 'nft'} scroll={false}>
              NFTs
            </Link>
          </div>
          <span className="text-break address-assets-hash">{a.hash}</span>
        </div>

        <div className="address-networth mb-4">
          <div>
            <h4 className="ex-cap mb-1" title={`The ${SITE.coin} balance plus the tokens that have a price`}>
              Net Worth in USD
            </h4>
            <div className="address-networth-value">{coinUsd === null ? '-' : usd(coinUsd + tokensUsd)}</div>
          </div>
          <div className="address-networth-sep">
            <h4 className="ex-cap mb-1">Net Worth in {SITE.coin}</h4>
            <div className="address-networth-value">
              {netCoin} {SITE.coin}
            </div>
          </div>
        </div>

        <h3 className="address-card-title mb-3">{view === 'nft' ? 'NFTs' : 'Tokens'}</h3>
        <div className="card address-assets-list">
          <ListHead right={<SearchForm hash={a.hash} view={view} q={q} />}>
            {view === 'nft' ? (
              <>
                Showing <b>{num(list.length)}</b> NFT {list.length === 1 ? 'collection' : 'collections'}
              </>
            ) : (
              <>
                Showing <b>{num(list.length)}</b> {list.length === 1 ? 'token' : 'tokens'}
                {listWorth !== null && (
                  <>
                    {' '}
                    with a value of <b>{listWorth}</b>
                  </>
                )}
              </>
            )}
          </ListHead>
          <div className="card-body p-0">
            {view === 'nft' ? <NftTable rows={rows} owner={a.hash} /> : <TokenTable rows={rows} owner={a.hash} />}
          </div>
          {list.length > 0 && <ListFoot nav={nav} />}
        </div>
      </div>
    </div>
  )
}

function TokenCell({ h, owner }: { h: HeldToken; owner: string }) {
  return (
    <Link href={`/token/${h.token.address_hash}?a=${owner}`} className="d-inline-flex align-items-center gap-1" title={label(h)}>
      {h.token.icon_url === null ? (
        <span className="address-holdings-icon" aria-hidden="true" />
      ) : (
        <img src={h.token.icon_url} width={14} height={14} className="address-holdings-icon" alt="" />
      )}
      <span className="ex-token-name">{label(h)}</span>
      {h.token.symbol !== null && <span className="text-muted">({h.token.symbol})</span>}
    </Link>
  )
}

function ContractCell({ hash }: { hash: string }) {
  return (
    <Link href={`/address/${hash}`} className="ex-hash" title={hash}>
      {hash}
    </Link>
  )
}

function TokenTable({ rows, owner }: { rows: HeldToken[]; owner: string }) {
  return (
    <div className="ex-table-wrap">
      <table className="ex-table">
        <thead>
          <tr>
            <th>Token</th>
            <th>Contract</th>
            <th>Price</th>
            <th>Amount</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow cols={5} />}
          {rows.map((h) => {
            const worth = worthOf(h)
            return (
              <tr key={h.token.address_hash}>
                <td>
                  <TokenCell h={h} owner={owner} />
                </td>
                <td>
                  <ContractCell hash={h.token.address_hash} />
                </td>
                <td>{h.token.exchange_rate === null ? '-' : `$${Number(h.token.exchange_rate).toLocaleString('en-US', { maximumFractionDigits: 6 })}`}</td>
                <td>
                  {formatUnits(h.value, decimalsOf(h))}
                  {h.token.symbol !== null && ` ${h.token.symbol}`}
                </td>
                <td>{worth === null ? '-' : usd(worth)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function NftTable({ rows, owner }: { rows: HeldToken[]; owner: string }) {
  return (
    <div className="ex-table-wrap">
      <table className="ex-table">
        <thead>
          <tr>
            <th>Collection</th>
            <th>Contract</th>
            <th>Type</th>
            <th>Quantity</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow cols={4} />}
          {rows.map((h) => (
            <tr key={`${h.token.address_hash}-${h.token_id === null ? '' : h.token_id}`}>
              <td>
                <TokenCell h={h} owner={owner} />
              </td>
              <td>
                <ContractCell hash={h.token.address_hash} />
              </td>
              <td>
                <span className="ex-badge">{h.token.type}</span>
              </td>
              <td>
                {h.token_id !== null && `#${h.token_id} `}x{num(h.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
