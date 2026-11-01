import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ListFoot, ListHead, ListTools } from '@/components/list'
import { AgeCell, AgeHead } from '@/components/tables'
import { EmptyRow, Note, PageHead } from '@/components/ui'
import { api, jump } from '@/lib/api'
import type { Sheet } from '@/lib/csv'
import { counted, formatUnits, listDate, num } from '@/lib/format'
import { baseFeeGwei, gasUsedPct } from '@/lib/lists-format'
import type { SP } from '@/lib/page'
import { jumpNav, pageFrom, pageSizeFrom, type PageSize } from '@/lib/paging'
import { SITE } from '@/lib/site'
import type { Block, Page } from '@/lib/types'

export const metadata = { title: 'Blocks' }

const DEFAULT_SIZE: PageSize = 25

/** Page `p` of the blocks, newest first, and the chain head it was counted from (null on an empty index). */
async function load(p: number, size: PageSize): Promise<{ page: Page<Block>; top: number | null }> {
  if (p === 1) {
    const page = await api.blocks({ items_count: size })
    const head = page.items[0]
    return { page, top: head === undefined ? null : head.height }
  }
  const latest = (await api.blocks({ items_count: 1 })).items[0]
  if (latest === undefined) notFound()
  const cursor = jump.blocks(latest.height, p, size)
  if (cursor === null) notFound() // a page past block 0
  return { page: await api.blocks({ ...cursor, items_count: size }), top: latest.height }
}

/** "Download Page Data" for the blocks on screen, in the table's columns. */
function blockSheet(blocks: Block[], page: number): Sheet {
  return {
    name: `export-blocks-page${page}.csv`,
    header: ['Block', 'DateTime (UTC)', 'Txn', 'Gas Used', 'Gas Limit', 'Base Fee (Gwei)'],
    rows: blocks.map((b) => [
      String(b.height),
      listDate(b.timestamp),
      String(b.transactions_count),
      b.gas_used,
      b.gas_limit,
      b.base_fee_per_gas === null ? '' : formatUnits(b.base_fee_per_gas, 9, { grouped: false }),
    ]),
  }
}

function GasUsed({ b }: { b: Block }) {
  const pct = gasUsedPct(b.gas_used, b.gas_limit)
  const tone = pct.width >= 90 ? ' ex-gas-high' : pct.width >= 50 ? ' ex-gas-mid' : ''
  return (
    <>
      <div>
        {num(b.gas_used)}{' '}
        <span className="small text-muted">
          (<span title="Gas Used %">{pct.text}</span>)
        </span>
      </div>
      <div className="ex-gas-bar">
        <div className={`ex-gas-fill${tone}`} style={{ width: `${Math.min(pct.width, 100).toFixed(2)}%` }} />
      </div>
    </>
  )
}

function BaseFee({ wei }: { wei: string | null }) {
  if (wei === null) return <>-</>
  const g = baseFeeGwei(wei)
  return (
    <span title={`${formatUnits(wei, 18)} ${SITE.coin}`}>
      {g.int}
      {g.frac !== null && (
        <>
          <b>.</b>
          {g.frac}
        </>
      )}{' '}
      Gwei
    </span>
  )
}

/**
 * The blocks list in Arbiscan's Orbit layout: Block, Age, Txn, Gas Used (with its share of the limit and a thin bar),
 * Gas Limit, Base Fee. Etherscan's L1 columns (slot, blobs, fee recipient, reward, burnt fees) have no meaning on an
 * Orbit chain: the sequencer orders every block and the base fee is not burnt.
 */
export default async function Blocks({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const size = pageSizeFrom(sp, DEFAULT_SIZE)
  const p = pageFrom(sp)
  const { page, top } = await load(p, size)
  const total = top === null ? 0 : top + 1 // heights start at 0
  const nav = jumpNav({ base: '/blocks', keep: {}, size, defaultSize: DEFAULT_SIZE, total, page: p, hasNext: page.next_page_params !== null })
  const newest = page.items[0]
  const oldest = page.items.at(-1)
  return (
    <div className="container-xxl">
      <PageHead title="Blocks" />
      <div className="card">
        <ListHead right={<ListTools sheet={blockSheet(page.items, nav.page)} nav={nav} />}>
          Total of {counted(total, 'block')}
          {newest && oldest && (
            <span className="ex-list-sub">
              (Showing blocks between #{oldest.height} to #{newest.height})
            </span>
          )}
        </ListHead>
        <div className="card-body p-0">
          <div className="ex-table-wrap">
            <table className="ex-table">
              <thead>
                <tr>
                  <th>Block</th>
                  <AgeHead />
                  <th>Txn</th>
                  <th>Gas Used</th>
                  <th>Gas Limit</th>
                  <th>Base Fee</th>
                </tr>
              </thead>
              <tbody>
                {page.items.length === 0 && <EmptyRow cols={6} />}
                {page.items.map((b) => (
                  <tr key={b.hash}>
                    <td>
                      <Link href={`/block/${b.height}`}>{b.height}</Link>
                    </td>
                    <td>
                      <AgeCell ts={b.timestamp} />
                    </td>
                    <td>
                      <Link href={`/txs?block=${b.height}`}>{b.transactions_count}</Link>
                    </td>
                    <td>
                      <GasUsed b={b} />
                    </td>
                    <td>{num(b.gas_limit)}</td>
                    <td>
                      <BaseFee wei={b.base_fee_per_gas} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <ListFoot nav={nav} />
      </div>
      <Note>A block is a batch of transactions the {SITE.chainName} sequencer ordered together.</Note>
    </div>
  )
}
