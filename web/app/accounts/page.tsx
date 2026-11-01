import { notFound } from 'next/navigation'
import { HashCell } from '@/components/chain-cells'
import { displayName } from '@/components/AddressLink'
import { ListFoot, ListHead, ListTools, WalkCount } from '@/components/list'
import { EmptyRow, Note, PageHead } from '@/components/ui'
import { accountsCursor, coinHeld, topAccounts, type AccountsCursor, type TopAccount } from '@/lib/chain-api'
import type { Sheet } from '@/lib/csv'
import { formatUnits, listCoin, num } from '@/lib/format'
import { getLabels } from '@/lib/labels'
import type { SP } from '@/lib/page'
import { pageSizeFrom, stackFrom, walkNav, type PageSize } from '@/lib/paging'
import { SITE } from '@/lib/site'

export const metadata = { title: `Top Accounts by ${SITE.coin} Balance` }

const DEFAULT_SIZE: PageSize = 25

/** Etherscan's balance cell: two decimals and "…" when the exact amount has more (the exact amount is on hover). */
function shortBalance(wei: string): string {
  const exact = formatUnits(wei, 18)
  const [int, frac] = exact.split('.')
  if (frac === undefined || frac.length <= 2) return exact
  // Below 0.01 two decimals would read "0.00…"; the list form keeps a non-zero balance visibly non-zero.
  if (int === '0' && frac.startsWith('00')) return listCoin(wei)
  return `${int}.${frac.slice(0, 2)}…`
}

/** The account's share of all HYPE held on the chain, "12.34567891%" (8 decimals, rounded half-up). */
function share(wei: string, held: bigint): string {
  const scaled = (BigInt(wei) * 10n ** 10n * 2n + held) / (held * 2n)
  const s = scaled.toString().padStart(9, '0')
  return `${num(s.slice(0, -8))}.${s.slice(-8)}%`
}

/** Blockscout writes "" for an address whose transactions it has not counted yet. */
const txCount = (a: TopAccount) => (a.transactions_count === '' ? '-' : num(a.transactions_count))

/** Etherscan's /accounts: the addresses holding the most of the chain's gas coin. */
export default async function Accounts({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const size = pageSizeFrom(sp, DEFAULT_SIZE)
  const stack = stackFrom(sp)
  let cursor: AccountsCursor | null = null
  for (const c of stack) {
    cursor = accountsCursor(c)
    if (cursor === null) notFound()
  }
  const [page, held, labels] = await Promise.all([topAccounts(size, cursor), coinHeld(), getLabels()])
  const more = page.next_page_params !== null
  const walked = stack.length * size
  const nav = walkNav({
    base: '/accounts',
    keep: {},
    size,
    defaultSize: DEFAULT_SIZE,
    total: more ? null : walked + page.items.length,
    stack,
    next: page.next_page_params,
  })
  const rows = page.items.map((a, i) => {
    const name = displayName(a, labels)
    return { a, rank: walked + i + 1, name, balance: shortBalance(a.coin_balance), pct: share(a.coin_balance, held) }
  })
  const sheet: Sheet = {
    name: `export-accounts-page${nav.page}.csv`,
    header: ['Rank', 'Address', 'Name Tag', `Balance (${SITE.coin})`, 'Percentage', 'Txn Count'],
    rows: rows.map((r) => [
      String(r.rank),
      r.a.hash,
      r.name === null ? '' : r.name,
      formatUnits(r.a.coin_balance, 18, { grouped: false }),
      r.pct,
      r.a.transactions_count,
    ]),
  }
  const [heldInt, heldFrac] = formatUnits(held, 18, { maxFraction: 3 }).split('.')
  return (
    <div className="container-xxl">
      <PageHead title={`Top Accounts by ${SITE.coin} Balance`} />
      <div className="card">
        <ListHead right={<ListTools sheet={sheet} nav={nav} />}>
          <WalkCount walked={walked} rows={page.items.length} more={more} noun="account" /> ({heldInt}
          {heldFrac !== undefined && (
            <>
              <b>.</b>
              {heldFrac}
            </>
          )}{' '}
          {SITE.coin})<span className="ex-list-sub">(Accounts holding {SITE.coin} only)</span>
        </ListHead>
        <div className="card-body p-0">
          <div className="ex-table-wrap">
            <table className="ex-table">
              <thead>
                <tr>
                  <th className="text-center">#</th>
                  <th>Address</th>
                  <th>Name Tag</th>
                  <th>Balance</th>
                  <th>Percentage</th>
                  <th>Txn Count</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <EmptyRow cols={6} />}
                {rows.map((r) => (
                  <tr key={r.a.hash}>
                    <td className="text-center text-muted">{num(r.rank)}</td>
                    <td>
                      <HashCell a={r.a} name={r.name} />
                    </td>
                    <td>{r.name === null ? '' : r.name}</td>
                    <td>
                      <span title={`${formatUnits(r.a.coin_balance, 18)} ${SITE.coin}`}>
                        {r.balance} {SITE.coin}
                      </span>
                    </td>
                    <td>{r.pct}</td>
                    <td>{txCount(r.a)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <ListFoot nav={nav} />
      </div>
      <Note>
        Balances are the {SITE.coin} each address holds on {SITE.chainName}, as last read from the chain. Percentage is the
        share of all {SITE.coin} held on {SITE.chainName}, the figure in brackets above, not of {SITE.coin}&apos;s supply on
        other chains.
      </Note>
    </div>
  )
}
