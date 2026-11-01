import { ListFoot, ListHead, ListTools, WalkCount } from '@/components/list'
import { NftTransferTable, nftSheet, rowsFromMints, type NftMint } from '@/components/token-nft'
import { Note, PageHead } from '@/components/ui'
import type { SP } from '@/lib/page'
import { pageSizeFrom, stackFrom, walkNav, walkParams, type PageSize } from '@/lib/paging'
import { SITE } from '@/lib/site'
import { tokenApi } from '@/lib/token-api'

export const metadata = { title: 'NFT Latest Mints' }

const DEFAULT_SIZE: PageSize = 25

/**
 * Etherscan's /nft-latest-mints: NFT transfers out of the zero address, newest first (Blockscout's advanced filter).
 * The filter asks for ERC-721 and ERC-1155 rows only, and every such row names its token and its recipient.
 */
export default async function NftLatestMints({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const size = pageSizeFrom(sp, DEFAULT_SIZE)
  const stack = stackFrom(sp)
  const page = await tokenApi.nftMints(walkParams(stack, size))
  const mints = page.items.filter((m): m is NftMint => m.token !== null && m.to !== null)
  if (mints.length !== page.items.length) throw new Error('Blockscout returned an NFT mint without its token or recipient')
  const more = page.next_page_params !== null
  const walked = stack.length * size
  const nav = walkNav({
    base: '/nft-latest-mints',
    keep: {},
    size,
    defaultSize: DEFAULT_SIZE,
    total: more ? null : walked + page.items.length,
    stack,
    next: page.next_page_params,
  })
  const rows = rowsFromMints(mints)
  return (
    <div className="container-xxl">
      <PageHead title="NFT Latest Mints" />
      <div className="card">
        <ListHead right={<ListTools sheet={await nftSheet(rows, 'nft-mints', nav.page)} nav={nav} />}>
          <WalkCount walked={walked} rows={page.items.length} more={more} noun="mint" />
        </ListHead>
        <div className="card-body p-0">
          <NftTransferTable rows={rows} variant="mints" />
        </div>
        <ListFoot nav={nav} />
      </div>
      <Note>
        A mint creates a new NFT: it arrives from the zero address in the wallet of whoever made it. This list shows the newest NFTs created on{' '}
        {SITE.chainName}.
      </Note>
    </div>
  )
}
