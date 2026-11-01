import { notFound } from 'next/navigation'
import { MessageStatus, statusText } from '@/components/chain-bridge'
import { AddrHash, Age, ParentTxHash, TxHash } from '@/components/chain-cells'
import { ListFoot, ListHead, ListTools } from '@/components/list'
import { AgeHead } from '@/components/tables'
import { EmptyRow, Note, PageHead } from '@/components/ui'
import { exitCount, exitJump, exitMessages, type ArbMessage } from '@/lib/chain-api'
import type { Sheet } from '@/lib/csv'
import { counted, listDate } from '@/lib/format'
import type { SP } from '@/lib/page'
import { jumpNav, pageFrom, pageSizeFrom, type PageSize } from '@/lib/paging'
import { SITE } from '@/lib/site'
import type { Page } from '@/lib/types'

export const metadata = { title: 'L2 to L1 Transactions' }

const DEFAULT_SIZE: PageSize = 50

const EMPTY: Page<ArbMessage> = { items: [], next_page_params: null }

/** Arbiscan's /txsExit: messages sent from the chain to its parent chain (withdrawals), newest first. */
export default async function TxsExit({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const size = pageSizeFrom(sp, DEFAULT_SIZE)
  const p = pageFrom(sp)
  const total = await exitCount()
  // A page past the last one is a bad link (page 1 stays valid on an empty list).
  if (p > Math.max(1, Math.ceil(total / size))) notFound()
  const cursor = p === 1 ? {} : exitJump(total, p, size)
  const page = cursor === null ? EMPTY : await exitMessages({ ...cursor, items_count: size })
  const nav = jumpNav({ base: '/txsExit', keep: {}, size, defaultSize: DEFAULT_SIZE, total, page: p, hasNext: page.next_page_params !== null })
  const sheet: Sheet = {
    name: `export-txsExit-page${p}.csv`,
    header: ['Unique ID', 'From', 'L2 Tx Hash', 'DateTime (UTC)', 'Status', 'L1 Txn Hash'],
    rows: page.items.map((m) => [
      String(m.id),
      m.origination_address_hash === null ? '' : m.origination_address_hash,
      m.origination_transaction_hash === null ? '' : m.origination_transaction_hash,
      m.origination_timestamp === null ? '' : listDate(m.origination_timestamp),
      statusText('exit', m.status),
      m.completion_transaction_hash === null ? '' : m.completion_transaction_hash,
    ]),
  }
  return (
    <div className="container-xxl">
      <PageHead title="L2→L1 Transactions">
        <span className="text-muted small">
          {SITE.chainName} → {SITE.parentChain}
        </span>
      </PageHead>
      <div className="card">
        <ListHead right={<ListTools sheet={sheet} nav={nav} />}>A total of {counted(total, 'transaction')} found</ListHead>
        <div className="card-body p-0">
          <div className="ex-table-wrap">
            <table className="ex-table">
              <thead>
                <tr>
                  <th>Unique ID</th>
                  <th>From</th>
                  <th>L2 Tx Hash</th>
                  <AgeHead />
                  <th>Status</th>
                  <th>L1 Txn Hash</th>
                </tr>
              </thead>
              <tbody>
                {page.items.length === 0 && <EmptyRow cols={6} />}
                {page.items.map((m) => (
                  <tr key={m.id}>
                    <td>{m.id}</td>
                    <td>{m.origination_address_hash === null ? '-' : <AddrHash hash={m.origination_address_hash} />}</td>
                    <td>{m.origination_transaction_hash === null ? '-' : <TxHash hash={m.origination_transaction_hash} />}</td>
                    <td>{m.origination_timestamp === null ? '-' : <Age ts={m.origination_timestamp} />}</td>
                    <td>
                      <MessageStatus dir="exit" status={m.status} />
                    </td>
                    <td>{m.completion_transaction_hash === null ? '-' : <ParentTxHash hash={m.completion_transaction_hash} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <ListFoot nav={nav} />
      </div>
      <Note>
        L2→L1 transactions are messages sent from {SITE.chainName} to {SITE.parentChain}, such as withdrawals. Each one can be
        executed (claimed) on {SITE.parentChain} once the batch holding it is confirmed there, after the rollup&apos;s challenge
        period. The L1 transaction hash is that execution on {SITE.parentChain}, &quot;-&quot; until it happens.
      </Note>
    </div>
  )
}
