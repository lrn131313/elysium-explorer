import { notFound } from 'next/navigation'
import { AddressLink } from '@/components/AddressLink'
import { ListFoot, ListHead, ListTools, WalkCount } from '@/components/list'
import { InternalTable, internalSheet } from '@/components/tables'
import { Note, PageHead } from '@/components/ui'
import { api } from '@/lib/api'
import { isAddress } from '@/lib/format'
import { one, orNotFound, type SP } from '@/lib/page'
import { pageSizeFrom, stackFrom, walkNav, walkParams, type PageSize } from '@/lib/paging'

export const metadata = { title: 'Contract Internal Transactions' }

const DEFAULT_SIZE: PageSize = 50

/** Etherscan's /txsInternal: every internal call that moved value or created a contract; `?a=` narrows it to one address. */
export default async function TxsInternal({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const addr = one(sp, 'a')
  if (addr !== undefined && !isAddress(addr)) notFound()
  const size = pageSizeFrom(sp, DEFAULT_SIZE)
  const stack = stackFrom(sp)
  const params = walkParams(stack, size)
  const a = addr === undefined ? null : await orNotFound(api.address(addr))
  const page = a === null ? await api.internalTxs(size, params) : await api.addressInternalValued(a.hash, size, params)
  const more = page.next_page_params !== null
  const walked = stack.length * size
  const nav = walkNav({
    base: '/txsInternal',
    keep: a === null ? {} : { a: a.hash },
    size,
    defaultSize: DEFAULT_SIZE,
    total: more ? null : walked + page.items.length,
    stack,
    next: page.next_page_params,
  })
  return (
    <div className="container-xxl">
      <PageHead title={a === null ? 'Contract Internal Transactions' : 'Internal Transactions'}>
        {a !== null && (
          <span className="text-muted d-inline-flex align-items-center gap-1">
            For <AddressLink a={a} full copy />
          </span>
        )}
      </PageHead>
      <div className="card">
        <ListHead right={<ListTools sheet={await internalSheet(page.items, a === null ? undefined : a.hash, nav.page)} nav={nav} />}>
          <WalkCount walked={walked} rows={page.items.length} more={more} noun="internal transaction" />
        </ListHead>
        <div className="card-body p-0">
          {a === null ? <InternalTable items={page.items} variant="global" /> : <InternalTable items={page.items} me={a.hash} />}
        </div>
        <ListFoot nav={nav} />
      </div>
      <Note>
        Internal transactions are value transfers and contract creations made by contract code while a transaction runs. They are
        part of their parent transaction, not separate transactions on the chain.
      </Note>
    </div>
  )
}
