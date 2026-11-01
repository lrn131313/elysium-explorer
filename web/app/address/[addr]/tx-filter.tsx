import { ArrowLeft, ArrowRight, Circle, CircleAlert, Funnel, Newspaper } from 'lucide-react'
import Link from 'next/link'
import { AddressMenu } from '@/components/address-menu'

/** Why the pending view is off: an Arbitrum Orbit sequencer orders transactions as they arrive; there is no public mempool. */
const PENDING_TIP = 'Not available on this chain: its sequencer orders transactions as they arrive, so there is no public pool of pending ones'

/**
 * Etherscan's funnel menu beside "Download Page Data" on an address's Transactions tab. Each entry opens the full list
 * (`/txs?a=`) with Etherscan's own filter parameter: f=2 outgoing, f=3 incoming, f=5 contract creation. Failed-only is
 * greyed out with Etherscan's own words, as there.
 */
export function TxFilter({ hash }: { hash: string }) {
  const all = `/txs?a=${hash}`
  return (
    <AddressMenu label={<Funnel size={13} className="text-muted" />} title="Filter transactions">
      <Link className="address-menu-item" role="menuitem" href={all}>
        <Circle size={11} fill="currentColor" className="address-menu-icon" />
        View Completed Txns
      </Link>
      <span className="address-menu-item disabled" role="menuitem" aria-disabled="true" title={PENDING_TIP}>
        <Circle size={11} className="address-menu-icon" />
        View Pending Txns
      </span>
      <span className="address-menu-item disabled" role="menuitem" aria-disabled="true" title="Option Not Available for this Address">
        <CircleAlert size={12} className="address-menu-icon" />
        View Failed Txns
      </span>
      <div className="address-menu-sep" role="separator" />
      <Link className="address-menu-item" role="menuitem" href={`${all}&f=2`}>
        <ArrowRight size={12} className="address-menu-icon" />
        View Outgoing Txns
      </Link>
      <Link className="address-menu-item" role="menuitem" href={`${all}&f=3`}>
        <ArrowLeft size={12} className="address-menu-icon" />
        View Incoming Txns
      </Link>
      <Link className="address-menu-item" role="menuitem" href={`${all}&f=5`}>
        <Newspaper size={12} className="address-menu-icon" />
        View Contract Creation
      </Link>
    </AddressMenu>
  )
}
