import { ListFoot, ListHead, ListTools, WalkCount } from '@/components/list'
import { NftTransferTable, nftSheet, rowsFromTransfers } from '@/components/token-nft'
import { Note, PageHead } from '@/components/ui'
import type { SP } from '@/lib/page'
import { pageSizeFrom, stackFrom, walkNav, walkParams, type PageSize } from '@/lib/paging'
import { SITE } from '@/lib/site'
import { tokenApi } from '@/lib/token-api'

export const metadata = { title: 'NFT Transfers' }

const DEFAULT_SIZE: PageSize = 25

/** Etherscan's /nft-transfers: every ERC-721 and ERC-1155 transfer on the chain, newest first. */
export default async function NftTransfers({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const size = pageSizeFrom(sp, DEFAULT_SIZE)
  const stack = stackFrom(sp)
  const page = await tokenApi.nftTransfers(walkParams(stack, size))
  const more = page.next_page_params !== null
  const walked = stack.length * size
  const nav = walkNav({
    base: '/nft-transfers',
    keep: {},
    size,
    defaultSize: DEFAULT_SIZE,
    total: more ? null : walked + page.items.length,
    stack,
    next: page.next_page_params,
  })
  const rows = rowsFromTransfers(page.items)
  return (
    <div className="container-xxl">
      <PageHead title="NFT Transfers" />
      <div className="card">
        <ListHead right={<ListTools sheet={await nftSheet(rows, 'nft-transfers', nav.page)} nav={nav} />}>
          <WalkCount walked={walked} rows={page.items.length} more={more} noun="transaction" />
        </ListHead>
        <div className="card-body p-0">
          <NftTransferTable rows={rows} variant="feed" />
        </div>
        <ListFoot nav={nav} />
      </div>
      <Note>
        NFTs (ERC-721 and ERC-1155 tokens) are unique items: each one has its own token id. This list shows every NFT that changed hands on {SITE.chainName},
        newest first.
      </Note>
    </div>
  )
}
