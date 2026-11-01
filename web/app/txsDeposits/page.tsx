import { notFound } from 'next/navigation'
import { MessageStatus, statusText } from '@/components/chain-bridge'
import { Age, Help, ParentAddrHash, ParentBlock, ParentTxHash, TxHash } from '@/components/chain-cells'
import { ListFoot, ListHead, ListTools } from '@/components/list'
import { AgeHead } from '@/components/tables'
import { EmptyRow, Note, PageHead } from '@/components/ui'
import { depositCount, depositMessages, isIdCursor, txTimes } from '@/lib/chain-api'
import type { Sheet } from '@/lib/csv'
import { counted, listDate } from '@/lib/format'
import type { SP } from '@/lib/page'
import { pageSizeFrom, stackFrom, walkNav, walkParams, type PageSize } from '@/lib/paging'
import { SITE } from '@/lib/site'

export const metadata = { title: 'L1 to L2 Transactions' }

const DEFAULT_SIZE: PageSize = 50

const AGE_TIP = `When the deposit was executed on ${SITE.chainName}.`

/**
 * Arbiscan's /txsDeposits: messages from the parent chain executed on the chain (deposits), newest first. Message ids
 * here are the parent chain's inbox positions, which include messages this explorer never sees, so the list can only
 * be walked page by page.
 */
export default async function TxsDeposits({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const size = pageSizeFrom(sp, DEFAULT_SIZE)
  const stack = stackFrom(sp)
  if (!stack.every(isIdCursor)) notFound()
  const [page, total] = await Promise.all([depositMessages(walkParams(stack, size)), depositCount()])
  const l2Hashes = page.items.flatMap((m) => (m.completion_transaction_hash === null ? [] : [m.completion_transaction_hash]))
  const times = await txTimes(l2Hashes)
  const timeOf = (hash: string): string => {
    const t = times.get(hash.toLowerCase())
    if (t === undefined) throw new Error(`txTimes returned no time for ${hash}`)
    return t
  }
  const rows = page.items.map((m) => ({ m, ts: m.completion_transaction_hash === null ? null : timeOf(m.completion_transaction_hash) }))
  const nav = walkNav({ base: '/txsDeposits', keep: {}, size, defaultSize: DEFAULT_SIZE, total, stack, next: page.next_page_params })
  const sheet: Sheet = {
    name: `export-txsDeposits-page${nav.page}.csv`,
    header: ['Block No', 'Queue Index', 'L2 Tx Hash', 'DateTime (UTC)', 'Status', 'L1 Txn Hash', 'L1 Tx Origin'],
    rows: rows.map(({ m, ts }) => {
      return [
        m.origination_transaction_block_number === null ? '' : String(m.origination_transaction_block_number),
        String(m.id),
        m.completion_transaction_hash === null ? '' : m.completion_transaction_hash,
        ts === null ? '' : listDate(ts),
        statusText('deposit', m.status),
        m.origination_transaction_hash === null ? '' : m.origination_transaction_hash,
        m.origination_address_hash === null ? '' : m.origination_address_hash,
      ]
    }),
  }
  return (
    <div className="container-xxl">
      <PageHead title="L1→L2 Transactions">
        <span className="text-muted small">
          {SITE.parentChain} → {SITE.chainName}
        </span>
      </PageHead>
      <div className="card">
        <ListHead right={<ListTools sheet={sheet} nav={nav} />}>A total of {counted(total, 'transaction')} found</ListHead>
        <div className="card-body p-0">
          <div className="ex-table-wrap">
            <table className="ex-table">
              <thead>
                <tr>
                  <th>Block No</th>
                  <th>Queue Index</th>
                  <th>L2 Tx Hash</th>
                  <AgeHead>
                    {' '}
                    <Help tip={AGE_TIP} />
                  </AgeHead>
                  <th>Status</th>
                  <th>L1 Txn Hash</th>
                  <th>L1 Tx Origin</th>
                </tr>
              </thead>
              <tbody>
                {page.items.length === 0 && <EmptyRow cols={7} />}
                {rows.map(({ m, ts }) => {
                  return (
                    <tr key={m.id}>
                      <td>{m.origination_transaction_block_number === null ? '-' : <ParentBlock n={m.origination_transaction_block_number} />}</td>
                      <td>{m.id}</td>
                      <td>
                        {m.completion_transaction_hash === null ? (
                          <span title={`Not executed on ${SITE.chainName} yet.`}>Pending Confirmation</span>
                        ) : (
                          <TxHash hash={m.completion_transaction_hash} />
                        )}
                      </td>
                      <td>{ts === null ? '-' : <Age ts={ts} />}</td>
                      <td>
                        <MessageStatus dir="deposit" status={m.status} />
                      </td>
                      <td>{m.origination_transaction_hash === null ? '-' : <ParentTxHash hash={m.origination_transaction_hash} />}</td>
                      <td>{m.origination_address_hash === null ? '-' : <ParentAddrHash hash={m.origination_address_hash} />}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <ListFoot nav={nav} />
      </div>
      <Note>
        L1→L2 transactions are messages from {SITE.parentChain} executed on {SITE.chainName}, such as deposits. The queue index is
        the message&apos;s place in the chain&apos;s inbox. The {SITE.parentChain} side of each message (its block, transaction
        and sender) opens on {SITE.parentChain}&apos;s explorer; a message stays Pending until it is executed on {SITE.chainName}.
      </Note>
    </div>
  )
}
