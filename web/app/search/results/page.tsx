import Link from 'next/link'
import { Empty, PageHead } from '@/components/ui'
import { api } from '@/lib/api'
import { ADDRESS_TYPES, FILTER_LABEL, parseFilter, TYPE_LABELS, type SearchFilter } from '@/lib/chrome-search'
import { mid } from '@/lib/format'
import { getLabels } from '@/lib/labels'
import { one, type SP } from '@/lib/page'
import type { SearchItem } from '@/lib/types'

export const metadata = { title: 'Search results' }

/** Most name tags a single search lists; the pool tags alone run into the thousands. */
const MAX_TAGS = 50

function href(it: SearchItem): string | null {
  if (it.type === 'block' && it.block_number !== undefined) return `/block/${it.block_number}`
  if (it.type === 'transaction' && it.transaction_hash) return `/tx/${it.transaction_hash}`
  if (it.type === 'token' && it.address_hash) return `/token/${it.address_hash}`
  if (it.address_hash) return `/address/${it.address_hash}`
  return null
}

const keep = (f: SearchFilter, it: SearchItem) => f === 'all' || (f === 'token' ? it.type === 'token' : ADDRESS_TYPES.has(it.type))

interface TagHit {
  address: string
  name: string
  project: string
}

/** Our own name tags whose name or project contains the query (case-insensitive). */
async function tagHits(q: string): Promise<TagHit[]> {
  const needle = q.toLowerCase()
  const hits: TagHit[] = []
  for (const [address, l] of await getLabels()) {
    if (l.name.toLowerCase().includes(needle) || l.project.toLowerCase().includes(needle)) hits.push({ address, ...l })
    if (hits.length === MAX_TAGS) break
  }
  return hits
}

export default async function SearchResults({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const q = (one(sp, 'q') ?? '').trim()
  const f = parseFilter(one(sp, 'f'))
  const [items, tags] = await Promise.all([
    q && f !== 'nametag' ? api.search(q).then((p) => p.items.filter((it) => keep(f, it))) : Promise.resolve([]),
    q && (f === 'all' || f === 'nametag') ? tagHits(q) : Promise.resolve([]),
  ])

  return (
    <div className="container-xxl">
      <PageHead title="Search results">
        <span className="text-muted">
          for &ldquo;{q}&rdquo;{f !== 'all' && <> in {FILTER_LABEL[f]}</>}
        </span>
      </PageHead>
      <div className="card">
        <div className="card-body">
          {items.length === 0 && tags.length === 0 ? (
            <Empty title="No results found">Try a full address, transaction hash, block number, a token name or a name tag.</Empty>
          ) : (
            <ul className="list-unstyled m-0">
              {tags.map((t) => (
                <li key={`tag-${t.address}`} className="py-2 border-bottom d-flex flex-wrap gap-2 align-items-center">
                  <span className="ex-badge">Name Tag</span>
                  <Link href={`/address/${t.address}`}>{t.name}</Link>
                  <span className="text-muted font-mono fs-sm">{mid(t.address)}</span>
                </li>
              ))}
              {items.map((it, i) => {
                const h = href(it)
                const title = it.name ?? it.symbol ?? it.address_hash ?? it.transaction_hash ?? String(it.block_number ?? '')
                return (
                  <li key={i} className="py-2 border-bottom d-flex flex-wrap gap-2 align-items-center">
                    <span className="ex-badge">{TYPE_LABELS[it.type] ?? it.type}</span>
                    {h ? <Link href={h}>{title}</Link> : <span>{title}</span>}
                    {it.symbol && it.name && <span className="text-muted">({it.symbol})</span>}
                    {it.address_hash && <span className="text-muted font-mono fs-sm">{mid(it.address_hash)}</span>}
                  </li>
                )
              })}
            </ul>
          )}
          {tags.length === MAX_TAGS && <p className="text-muted fs-sm mt-3 mb-0">Showing the first {MAX_TAGS} name tags; type more of the name to narrow it down.</p>}
        </div>
      </div>
    </div>
  )
}
