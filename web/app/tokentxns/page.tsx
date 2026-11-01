import { notFound } from 'next/navigation'
import { AddressLink } from '@/components/AddressLink'
import { ListFoot, ListHead, ListTools, WalkCount } from '@/components/list'
import { TokenTransferTable, tokenTransferSheet } from '@/components/tables'
import { Note, PageHead } from '@/components/ui'
import { api } from '@/lib/api'
import { isAddress } from '@/lib/format'
import { one, orNotFound, type SP } from '@/lib/page'
import { pageSizeFrom, stackFrom, walkNav, walkParams, type PageSize } from '@/lib/paging'

export const metadata = { title: 'Token Transfers (ERC-20)' }

const DEFAULT_SIZE: PageSize = 50

/** Etherscan's /tokentxns: every ERC-20 transfer, newest first; `?a=` narrows it to one address's transfers. */
export default async function TokenTxns({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const addr = one(sp, 'a')
  if (addr !== undefined && !isAddress(addr)) notFound()
  const size = pageSizeFrom(sp, DEFAULT_SIZE)
  const stack = stackFrom(sp)
  const params = walkParams(stack, size)
  const a = addr === undefined ? null : await orNotFound(api.address(addr))
  const page = a === null ? await api.erc20Transfers(params) : await api.addressErc20Transfers(a.hash, params)
  const more = page.next_page_params !== null
  const walked = stack.length * size
  const nav = walkNav({
    base: '/tokentxns',
    keep: a === null ? {} : { a: a.hash },
    size,
    defaultSize: DEFAULT_SIZE,
    total: more ? null : walked + page.items.length,
    stack,
    next: page.next_page_params,
  })
  return (
    <div className="container-xxl">
      <PageHead title="Token Transfers (ERC-20)">
        {a !== null && (
          <span className="text-muted d-inline-flex align-items-center gap-1">
            For <AddressLink a={a} full copy />
          </span>
        )}
      </PageHead>
      <div className="card">
        <ListHead right={<ListTools sheet={await tokenTransferSheet(page.items, a === null ? undefined : a.hash, nav.page)} nav={nav} />}>
          <WalkCount walked={walked} rows={page.items.length} more={more} noun="transaction" />
        </ListHead>
        <div className="card-body p-0">
          {a === null ? <TokenTransferTable items={page.items} /> : <TokenTransferTable items={page.items} me={a.hash} />}
        </div>
        <ListFoot nav={nav} />
      </div>
      <Note>
        ERC-20 is the standard for fungible tokens: every unit of a token is the same as any other. This list shows their transfers
        between addresses, newest first.
      </Note>
    </div>
  )
}
