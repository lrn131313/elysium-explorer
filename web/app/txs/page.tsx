import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddressLink } from '@/components/AddressLink'
import { ListFoot, ListHead, ListTools } from '@/components/list'
import { TxTable, txSheet } from '@/components/tables'
import { Note, PageHead } from '@/components/ui'
import { api } from '@/lib/api'
import { counted, formatUnits, isAddress, isBlockNumber, listCoin, num, usdOf } from '@/lib/format'
import {
  LEGACY_WINDOW,
  TX_FILTER_PARAM,
  addressTxCount,
  addressTxsCursor,
  addressTxsFiltered,
  countAddressTxs,
  creationTx,
  creationTxHashes,
  txStats,
  type TxFilter,
} from '@/lib/lists-api'
import { fixedUnits } from '@/lib/lists-format'
import { SITE } from '@/lib/site'
import { one, orNotFound, type SP } from '@/lib/page'
import { jumpNav, pageFrom, pageSizeFrom, stackFrom, walkNav, walkParams, type Nav, type PageSize } from '@/lib/paging'
import type { AddressInfo, Transaction } from '@/lib/types'

export const metadata = { title: 'Transactions' }

const DEFAULT_SIZE: PageSize = 50

async function List({ head, nav, txs, me, scope }: { head: React.ReactNode; nav: Nav; txs: Transaction[]; me?: string; scope?: string }) {
  const sheet = await txSheet(txs, scope, nav.page)
  return (
    <div className="card">
      <ListHead right={<ListTools sheet={sheet} nav={nav} />}>{head}</ListHead>
      <div className="card-body p-0">
        <TxTable txs={txs} me={me} />
      </div>
      <ListFoot nav={nav} />
    </div>
  )
}

function StatCard({ title, value, tip }: { title: string; value: string; tip?: string }) {
  return (
    <div className="col-sm-6 col-lg-3">
      <Link className="card h-100 ex-stat" href="/charts">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <h6 className="ex-cap mb-0">{title}</h6>
            <ArrowUpRight size={14} className="ex-stat-arrow" aria-hidden="true" />
          </div>
          <span className="ex-stat-value" title={tip}>
            {value}
          </span>
        </div>
      </Link>
    </div>
  )
}

/**
 * Etherscan's four cards above /txs. Its "Pending Transactions (Last 1H)" is always 0 here (no public mempool), so the
 * chain's transaction total stands in its place. Blockscout gives no previous-day figures, so the % changes are left out.
 */
async function TxStatCards({ total }: { total: number }) {
  const [s, rate] = await Promise.all([txStats(), api.stats().then((x) => x.coin_price)])
  const sum = s.transaction_fees_sum_24h
  const avg = s.transaction_fees_avg_24h
  const avgUsd = usdOf(avg, rate)
  return (
    <div className="row g-4 mb-4">
      <StatCard title="Transactions (24H)" value={num(s.transactions_count_24h)} />
      <StatCard title="Transactions (Total)" value={num(total)} />
      <StatCard title="Total Transaction Fee (24H)" value={`${fixedUnits(sum, 18, 2)} ${SITE.coin}`} tip={`${formatUnits(sum, 18)} ${SITE.coin}`} />
      <StatCard
        title="Avg. Transaction Fee (24h)"
        value={`${listCoin(avg)} ${SITE.coin}`}
        tip={`${formatUnits(avg, 18)} ${SITE.coin}${avgUsd === null ? '' : ` | ${avgUsd}`}`}
      />
    </div>
  )
}

const FILTER_NOTE: Record<TxFilter, { scope: string; note: string }> = {
  from: { scope: 'outgoing', note: 'Outgoing transactions only' },
  to: { scope: 'incoming', note: 'Incoming transactions only' },
  creation: { scope: 'contract-creation', note: 'Contract creation transactions only' },
}

/** One page of an address's transactions, all or one direction: any page within the legacy window, by number. */
async function directionPage(a: AddressInfo, filter: 'from' | 'to' | null, page: number, size: PageSize) {
  // Pages are found through the legacy API, which reaches its first 10,000 rows only; Etherscan caps its lists too.
  const windowPages = LEGACY_WINDOW / size
  if (page > windowPages) notFound()
  const [cursor, count] = await Promise.all([
    addressTxsCursor(a.hash, filter, page, size),
    filter === null ? addressTxCount(a) : countAddressTxs(a.hash, filter),
  ])
  if (cursor === null) notFound() // a page past the end of the list
  const list = await addressTxsFiltered(a.hash, filter, cursor, size)
  return { txs: list.items, count, hasNext: list.next_page_params !== null && page < windowPages }
}

/** One page of the address's contract-creation transactions (a short list, found whole; see creationTxHashes). */
async function creationPage(a: AddressInfo, page: number, size: PageSize) {
  const { hashes, complete } = await creationTxHashes(a)
  const pages = Math.max(1, Math.ceil(hashes.length / size))
  if (page > pages) notFound()
  const txs = await Promise.all(hashes.slice((page - 1) * size, page * size).map((h) => creationTx(h)))
  return { txs, count: { count: hashes.length, more: !complete }, hasNext: page < pages }
}

/**
 * Etherscan's /txs?a=ADDR: every transaction of one address, any page by number; `f` narrows it as the address's
 * filter menu does (2 outgoing, 3 incoming, 5 contract creation). Etherscan's failed-only view is not offered there
 * either ("Option Not Available for this Address"), so it has no parameter.
 */
async function ForAddress({ addr, sp, size }: { addr: string; sp: SP; size: PageSize }) {
  const page = pageFrom(sp)
  const f = one(sp, 'f')
  const filter = f === undefined ? null : TX_FILTER_PARAM.get(f)
  if (filter === undefined) notFound()
  const a = await orNotFound(api.address(addr))
  const { txs, count, hasNext } = filter === 'creation' ? await creationPage(a, page, size) : await directionPage(a, filter, page, size)
  const keep: Record<string, string> = f === undefined ? { a: a.hash } : { a: a.hash, f }
  const nav = jumpNav({ base: '/txs', keep, size, defaultSize: DEFAULT_SIZE, total: Math.min(count.count, LEGACY_WINDOW), page, hasNext })
  const notes = [filter === null ? null : FILTER_NOTE[filter].note, count.count > LEGACY_WINDOW || count.more ? 'Showing the last 10k records' : null].filter((n) => n !== null)
  return (
    <>
      <PageHead title="Transactions">
        <span className="text-muted d-inline-flex align-items-center gap-1">
          For <AddressLink a={a} full copy />
        </span>
      </PageHead>
      <List
        head={
          <>
            {count.more ? 'More than' : 'A total of'} {counted(count.count, 'transaction')} found
            {notes.length > 0 && <span className="ex-list-sub">({notes.join('. ')})</span>}
          </>
        }
        nav={nav}
        txs={txs}
        me={a.hash}
        scope={filter === null ? a.hash : `${a.hash}-${FILTER_NOTE[filter].scope}`}
      />
    </>
  )
}

export default async function Txs({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const block = one(sp, 'block')
  const addr = one(sp, 'a')
  if (block !== undefined && !isBlockNumber(block)) notFound()
  if (addr !== undefined && (!isAddress(addr) || block !== undefined)) notFound()
  if (one(sp, 'f') !== undefined && addr === undefined) notFound() // a filter narrows one address's list only
  const size = pageSizeFrom(sp, DEFAULT_SIZE)

  if (addr !== undefined)
    return (
      <div className="container-xxl">
        <ForAddress addr={addr} sp={sp} size={size} />
        <Note>A transaction is a cryptographically signed instruction that changes the blockchain state. Block explorers track the details of all transactions in the network.</Note>
      </div>
    )

  const stack = stackFrom(sp)
  const params = walkParams(stack, size)
  const [list, total] =
    block !== undefined
      ? await Promise.all([orNotFound(api.blockTxs(block, params)), orNotFound(api.block(block)).then((b) => b.transactions_count)])
      : await Promise.all([api.txs(params), api.stats().then((s) => Number(s.total_transactions))])
  const keep: Record<string, string> = block !== undefined ? { block } : {}
  const nav = walkNav({ base: '/txs', keep, size, defaultSize: DEFAULT_SIZE, total, stack, next: list.next_page_params })
  // Blockscout's transaction total is a cached counter that lags new blocks, hence "More than" (Etherscan says the same).
  const head = block !== undefined ? <>A total of {counted(total, 'transaction')} found</> : <>More than {counted(total, 'transaction')} found</>
  return (
    <div className="container-xxl">
      <PageHead title="Transactions">
        {block !== undefined && (
          <span className="text-muted">
            for Block <Link href={`/block/${block}`}>#{block}</Link>
          </span>
        )}
      </PageHead>
      {block === undefined && <TxStatCards total={total} />}
      <List head={head} nav={nav} txs={list.items} scope={block === undefined ? undefined : `block${block}`} />
      <Note>A transaction is a cryptographically signed instruction that changes the blockchain state. Block explorers track the details of all transactions in the network.</Note>
    </div>
  )
}
