import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ListFoot, ListHead } from '@/components/list'
import { Help, TokenLogo } from '@/components/tables'
import { EmptyRow, Note, PageHead } from '@/components/ui'
import { num, usd } from '@/lib/format'
import { countErc20Tokens, erc20Tokens, type TokenRow, type TokenSort } from '@/lib/lists-api'
import { one, type SP } from '@/lib/page'
import { pageSizeFrom, stackFrom, walkNav, walkParams, type PageSize } from '@/lib/paging'
import { SITE } from '@/lib/site'

export const metadata = { title: 'Token Tracker (ERC-20)' }

const DEFAULT_SIZE: PageSize = 50

/**
 * Etherscan's sort names in the URL (`/tokens?sort=holders&order=desc`) and the Blockscout sort each one asks for. A Map,
 * not an object: an object lookup would answer `sort=constructor` with Object's own members.
 */
const SORTS: ReadonlyMap<string, TokenSort> = new Map([
  ['price_usd', 'fiat_value'],
  ['marketcap', 'circulating_market_cap'],
  ['holders', 'holders_count'],
])
/** Blockscout's own order without a sort parameter: circulating market cap, highest first (as Etherscan's default). */
const DEFAULT_SORT = { key: 'marketcap', order: 'desc' } as const

type Order = 'asc' | 'desc'

/** `sort` / `order` from the URL; an unknown sort or order, or an order without a sort, is a bad URL. */
function sortFrom(sp: SP): { key: string; by: TokenSort; order: Order } | null {
  const key = one(sp, 'sort')
  const order = one(sp, 'order')
  if (key === undefined) {
    if (order !== undefined) notFound()
    return null
  }
  const by = SORTS.get(key)
  if (by === undefined || (order !== undefined && order !== 'asc' && order !== 'desc')) notFound()
  return { key, by, order: order === 'asc' ? 'asc' : 'desc' }
}

/** `q` from the URL, trimmed; a blank search is no search. */
function queryFrom(sp: SP): string | null {
  const raw = one(sp, 'q')
  if (raw === undefined) return null
  const q = raw.trim()
  return q === '' ? null : q
}

/** A sortable header: "Click for descending sort", or on the active column its arrow and the way to reverse it. A search stays on. */
function SortHead({ label, sortKey, active, q, help }: { label: string; sortKey: string; active: { key: string; order: Order }; q: string | null; help?: string }) {
  const on = active.key === sortKey
  const next: Order = on && active.order === 'desc' ? 'asc' : 'desc'
  const tip = !on ? 'Click for descending sort' : active.order === 'desc' ? 'Sorted in descending order, Click for ascending sort' : 'Sorted in ascending order, Click for descending sort'
  const query = new URLSearchParams(q === null ? { sort: sortKey, order: next } : { q, sort: sortKey, order: next })
  return (
    <th>
      {on && (active.order === 'desc' ? <ArrowDownWideNarrow size={12} className="ex-sort-icon" /> : <ArrowUpNarrowWide size={12} className="ex-sort-icon" />)}
      <Link href={`/tokens?${query.toString()}`} title={tip}>
        {label}
      </Link>
      {help && (
        <>
          {' '}
          <Help tip={help} />
        </>
      )}
    </th>
  )
}

/** "$0.999204": token prices keep up to 6 decimals (Etherscan's precision), dollars and market caps 2. */
function price(v: string | null): string {
  if (v === null) return '-'
  const n = Number(v)
  if (n > 0 && n < 0.000001) return '< $0.000001'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

const ONCHAIN_TIP = `Calculated by multiplying the token's Total Supply on ${SITE.chainName} with the current market price per token. Numbers may be unrealistic if the onchain supply is much larger than the reported circulating supply.`

const dollars = (v: string | null) => (v === null ? '-' : usd(Number(v)))

/** Price × the supply on this chain; "-" without a price, a supply or the token's decimals. */
function onchainCap(t: TokenRow): string {
  if (t.exchange_rate === null || t.total_supply === null || t.decimals === null) return '-'
  return usd((Number(BigInt(t.total_supply)) / 10 ** Number(t.decimals)) * Number(t.exchange_rate))
}

/** Etherscan's magnifier at the right of the header: it opens "Search for Token Name or Address" + Find, a plain GET. */
function TokenSearch({ q }: { q: string | null }) {
  return (
    <details className="ex-token-search">
      <summary className="btn btn-sm btn-secondary" title="Search for Token Name or Address" aria-label="Search tokens">
        <Search size={14} />
      </summary>
      <form action="/tokens" method="get" autoComplete="off" spellCheck={false} className="ex-token-search-panel bg-body">
        <div className="input-group">
          <input name="q" type="search" defaultValue={q === null ? '' : q} className="form-control py-2" placeholder="Search for Token Name or Address" />
          <button className="btn btn-primary" type="submit">
            Find
          </button>
        </div>
      </form>
    </details>
  )
}

/**
 * Etherscan's Token Tracker (ERC-20): rank, token, price, 24h volume, circulating and on-chain market cap, holders.
 * Prices come from Blockscout's market source and are null for every token here today, so those cells read "-";
 * Etherscan's Change (%) column and holder-trend figures have no data source at all and are left out.
 */
export default async function Tokens({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const size = pageSizeFrom(sp, DEFAULT_SIZE)
  const sort = sortFrom(sp)
  const q = queryFrom(sp)
  const stack = stackFrom(sp)
  const [page, total] = await Promise.all([erc20Tokens(walkParams(stack, size), size, sort === null ? null : { by: sort.by, order: sort.order }, q), countErc20Tokens(q)])
  const keep: Record<string, string> = { ...(q === null ? {} : { q }), ...(sort === null ? {} : { sort: sort.key, order: sort.order }) }
  const nav = walkNav({ base: '/tokens', keep, size, defaultSize: DEFAULT_SIZE, total, stack, next: page.next_page_params })
  const active = sort === null ? DEFAULT_SORT : sort
  const firstRank = stack.length * size + 1
  return (
    <div className="container-xxl">
      <PageHead title="Token Tracker (ERC-20)" />
      <div className="card">
        <ListHead right={<TokenSearch q={q} />}>
          A total of <strong>{num(total)}</strong> {total === 1 ? 'Token Contract' : 'Token Contracts'} found
          {q !== null && (
            <span className="ex-list-sub">
              Matching &ldquo;{q}&rdquo; &middot; <Link href="/tokens">Clear search</Link>
            </span>
          )}
        </ListHead>
        <div className="card-body p-0">
          <div className="ex-table-wrap">
            <table className="ex-table">
              <thead>
                <tr>
                  <th className="ex-th-rank">#</th>
                  <th>Token</th>
                  <SortHead label="Price" sortKey="price_usd" active={active} q={q} />
                  <th>Volume (24H)</th>
                  <SortHead
                    label="Circulating Market Cap"
                    sortKey="marketcap"
                    active={active}
                    q={q}
                    help="Calculated by multiplying the number of tokens in circulating supply across all chains with the current market price per token."
                  />
                  <th>
                    Onchain Market Cap <Help tip={ONCHAIN_TIP} />
                  </th>
                  <SortHead label="Holders" sortKey="holders" active={active} q={q} />
                </tr>
              </thead>
              <tbody>
                {page.items.length === 0 && <EmptyRow cols={7} />}
                {page.items.map((t, i) => (
                  <tr key={t.address_hash}>
                    <td className="ex-th-rank">{firstRank + i}</td>
                    <td>
                      <Link href={`/token/${t.address_hash}`} className="link-dark d-flex align-items-center gap-1" title={t.name ?? t.address_hash}>
                        <TokenLogo token={t} size={24} />
                        <span className="ex-token-list-name fw-medium">{t.name ?? 'Unnamed'}</span>
                        {t.symbol && <span className="text-muted">({t.symbol})</span>}
                      </Link>
                    </td>
                    <td>{price(t.exchange_rate)}</td>
                    <td>{dollars(t.volume_24h)}</td>
                    <td>{dollars(t.circulating_market_cap)}</td>
                    <td>{onchainCap(t)}</td>
                    <td>{t.holders_count === null ? '-' : num(t.holders_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <ListFoot nav={nav} />
      </div>
      <Note>Prices and market caps appear where a market price is known; most tokens launched on this chain have none yet.</Note>
    </div>
  )
}
