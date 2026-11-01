// Status of a message between Elysium and HyperEVM, for the two bridge lists (/txsExit, /txsDeposits).
import type { ArbMessage } from '@/lib/chain-api'
import { SITE } from '@/lib/site'

type Direction = 'exit' | 'deposit'

/**
 * Blockscout's four steps of an Arbitrum message, in words. Its bridge and batch tracking follow HyperEVM (enabled
 * 2026-11-01), so an exit moves on as its batch is posted, confirmed and claimed there, and a deposit is listed as
 * soon as it is sent on HyperEVM, then marked executed once Elysium runs it.
 */
const STATUS: Record<Direction, Record<ArbMessage['status'], { text: string; tip: string; badge: string }>> = {
  exit: {
    initiated: {
      text: 'Initiated',
      tip: `Sent from ${SITE.chainName}, not yet in a batch posted to ${SITE.parentChain}.`,
      badge: 'ex-badge',
    },
    sent: { text: 'Sent', tip: `Included in a batch posted to ${SITE.parentChain}; claimable once the rollup's challenge period ends.`, badge: 'ex-badge' },
    confirmed: { text: 'Ready to Execute', tip: `Confirmed on ${SITE.parentChain}; the receiver can now claim it there.`, badge: 'ex-badge ex-badge-warning' },
    relayed: { text: 'Executed', tip: `Executed (claimed) on ${SITE.parentChain}.`, badge: 'ex-badge ex-badge-success' },
  },
  deposit: {
    initiated: { text: 'Pending', tip: `Sent on ${SITE.parentChain}, not yet executed on ${SITE.chainName}.`, badge: 'ex-badge ex-badge-warning' },
    sent: { text: 'Pending', tip: `Sent on ${SITE.parentChain}, not yet executed on ${SITE.chainName}.`, badge: 'ex-badge ex-badge-warning' },
    confirmed: { text: 'Pending', tip: `Sent on ${SITE.parentChain}, not yet executed on ${SITE.chainName}.`, badge: 'ex-badge ex-badge-warning' },
    relayed: { text: 'Executed', tip: `Executed on ${SITE.chainName}.`, badge: 'ex-badge ex-badge-success' },
  },
}

export const statusText = (dir: Direction, s: ArbMessage['status']) => STATUS[dir][s].text

export function MessageStatus({ dir, status }: { dir: Direction; status: ArbMessage['status'] }) {
  const s = STATUS[dir][status]
  return (
    <span className={s.badge} title={s.tip}>
      {s.text}
    </span>
  )
}
