import { RefreshCw } from 'lucide-react'
import { unstable_rethrow } from 'next/navigation'
import { rpcBatch } from '@/lib/api'
import { num } from '@/lib/format'

/** The subset of Nitro's eth_syncing reply this banner reads (the node answers `false` once caught up). */
interface NitroSyncing {
  blockNum: number
  batchProcessed: number
  batchSeen: number
}

async function loadSyncing(): Promise<NitroSyncing | false | null> {
  try {
    const [r] = await rpcBatch([{ method: 'eth_syncing', params: [] }], 5_000)
    if (!r || 'error' in r) throw new Error(`eth_syncing: ${r ? r.error : 'no reply'}`)
    return r.result === false ? false : (r.result as NitroSyncing)
  } catch (e) {
    // Next's own control-flow signals (dynamic bailout, redirect, notFound) must pass through untouched.
    unstable_rethrow(e)
    // The banner is on every page; an unreachable node must not take every page down. Pages that need the node
    // still fail loudly through their own calls. Logged so the outage is visible.
    console.error('sync banner: node unavailable:', e instanceof Error ? e.message : e)
    return null
  }
}

/**
 * While our node is still replaying the chain, says how far it has got, so an address or token created later
 * is not mistaken for one that does not exist. Disappears once the node reports it is caught up.
 */
export async function SyncBanner() {
  const s = await loadSyncing()
  if (!s) return null
  const pctDone = s.batchSeen > 0 ? Math.floor((s.batchProcessed / s.batchSeen) * 100) : 0
  return (
    <div className="ex-syncbar" role="status">
      <div className="container-xxl d-flex align-items-center gap-2">
        <RefreshCw size={14} className="flex-shrink-0" />
        <span>
          This explorer is still catching up with the chain: it has reached block <strong>{num(s.blockNum)}</strong> (batch{' '}
          {num(s.batchProcessed)} of {num(s.batchSeen)}, {pctDone}%). Addresses, tokens and transactions from later blocks appear as
          it catches up.
        </span>
      </div>
    </div>
  )
}
