import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { api } from '@/lib/api'
import { parseFilter } from '@/lib/chrome-search'
import { isAddress, isBlockNumber, isTxHash } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * Search entry point: jump straight to the object when the query names one, else the results page. A full address
 * always opens its page; with a filter chosen, everything else goes to the filtered results.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const f = parseFilter(req.nextUrl.searchParams.get('f') ?? undefined)
  if (!q) redirect('/')
  if (isAddress(q)) redirect(`/address/${q}`)
  if (f !== 'all') redirect(`/search/results?q=${encodeURIComponent(q)}&f=${f}`)
  if (isBlockNumber(q)) redirect(`/block/${q}`)
  if (isTxHash(q)) {
    // A 32-byte hash is either a transaction or a block hash; Blockscout tells which.
    const r = await api.searchRedirect(q)
    if (r.redirect && r.type === 'block' && r.parameter) redirect(`/block/${q}`)
    redirect(`/tx/${q}`)
  }
  const r = await api.searchRedirect(q)
  if (r.redirect && r.parameter) {
    if (r.type === 'address') redirect(`/address/${r.parameter}`)
    if (r.type === 'block') redirect(`/block/${r.parameter}`)
    if (r.type === 'transaction') redirect(`/tx/${r.parameter}`)
  }
  redirect(`/search/results?q=${encodeURIComponent(q)}`)
}
