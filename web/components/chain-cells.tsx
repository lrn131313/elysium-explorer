// Table cells shared by the chain team's lists (Top Accounts, Verified Contracts, the bridge message lists, Gas Tracker).
// They repeat the markup of the cells in components/tables.tsx, which that file does not export.
import { ArrowUpRight, CircleHelp, FileText } from 'lucide-react'
import Link from 'next/link'
import { SITE } from '@/lib/site'
import type { AddressParam } from '@/lib/types'
import { MidHash } from './AddressLink'
import { CopyButton } from './client'

/** A column's "?" with its explanation on hover. */
export function Help({ tip }: { tip: string }) {
  return (
    <span title={tip} className="ex-help">
      <CircleHelp size={13} />
    </span>
  )
}

/**
 * An address as its shortened hash even when it has a name (the list shows the name in a column of its own, as on
 * Etherscan's Top Accounts); the name and full hash on hover, a page icon for contracts, a copy button.
 */
export function HashCell({ a, name, href }: { a: Pick<AddressParam, 'hash' | 'is_contract'>; name: string | null; href?: string }) {
  return (
    <span className="ex-addr d-inline-flex align-items-center gap-1">
      {a.is_contract && (
        <span className="ex-contract-icon" title="Contract">
          <FileText size={13} aria-label="Contract" />
        </span>
      )}
      <Link className="ex-addr-text" href={href ?? `/address/${a.hash}`} title={name === null ? a.hash : `${name}\n(${a.hash})`} data-hl={a.hash.toLowerCase()}>
        <MidHash hash={a.hash} />
      </Link>
      <CopyButton text={a.hash} label="Copy Address" />
    </span>
  )
}

/** An address known only by its hash (the bridge lists carry no name or contract flag): shortened hash, copy button. */
export function AddrHash({ hash }: { hash: string }) {
  return (
    <span className="ex-addr d-inline-flex align-items-center gap-1">
      <Link className="ex-addr-text" href={`/address/${hash}`} title={hash} data-hl={hash.toLowerCase()}>
        <MidHash hash={hash} />
      </Link>
      <CopyButton text={hash} label="Copy Address" />
    </span>
  )
}

/** A transaction hash, cut with an ellipsis by CSS (`ex-hash`), with a copy button. */
export function TxHash({ hash }: { hash: string }) {
  return (
    <span className="d-inline-flex align-items-center gap-1">
      <Link href={`/tx/${hash}`} className="ex-hash" data-hl={hash.toLowerCase()}>
        {hash}
      </Link>
      <CopyButton text={hash} label="Copy Transaction Hash" />
    </span>
  )
}

/**
 * The HyperEVM side of a bridge message lives on HyperEVM, not here: its block, transaction and sender link to
 * HyperEVM's explorer (a new tab), as Arbiscan links the Ethereum side to Etherscan. An L1 sender is not the same
 * account as the Elysium address with that hash, so it must not open this explorer's address page.
 */
function ParentLink({ path, className, title, hl, children }: { path: string; className?: string; title?: string; hl?: string; children: React.ReactNode }) {
  return (
    <a href={`${SITE.parentExplorer}${path}`} target="_blank" rel="noopener noreferrer" className={className} title={title} data-hl={hl}>
      {children}
    </a>
  )
}

/** A HyperEVM transaction hash (cut by CSS), on HyperEVM's explorer, with a copy button. */
export function ParentTxHash({ hash }: { hash: string }) {
  return (
    <span className="d-inline-flex align-items-center gap-1">
      <ParentLink path={`/tx/${hash}`} className="ex-hash" hl={hash.toLowerCase()}>
        {hash}
      </ParentLink>
      <CopyButton text={hash} label="Copy Transaction Hash" />
    </span>
  )
}

/** A HyperEVM address, shortened, on HyperEVM's explorer, with a copy button. */
export function ParentAddrHash({ hash }: { hash: string }) {
  return (
    <span className="ex-addr d-inline-flex align-items-center gap-1">
      <ParentLink path={`/address/${hash}`} className="ex-addr-text" title={hash} hl={hash.toLowerCase()}>
        <MidHash hash={hash} />
      </ParentLink>
      <CopyButton text={hash} label="Copy Address" />
    </span>
  )
}

/** A HyperEVM block number, on HyperEVM's explorer. */
export function ParentBlock({ n }: { n: number }) {
  return (
    <ParentLink path={`/block/${n}`} title={`${SITE.parentChain} block ${n}`}>
      {n}
    </ParentLink>
  )
}

/** One of Etherscan's figure cards above a list or on the charts page: an uppercase caption, then the figure. */
export function StatTile({ label, tip, href, children }: { label: string; tip?: string; href?: string; children: React.ReactNode }) {
  const body = (
    <div className="card-body">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <h3 className="ex-cap mb-0 d-inline-flex align-items-center gap-1">
          {label}
          {tip !== undefined && <Help tip={tip} />}
        </h3>
        {href !== undefined && <ArrowUpRight size={14} className="text-muted chain-tile-arrow" aria-hidden="true" />}
      </div>
      <div className="fs-5">{children}</div>
    </div>
  )
  return href === undefined ? (
    <div className="card h-100 chain-tile">{body}</div>
  ) : (
    <Link href={href} className="card h-100 chain-tile chain-tile-link">
      {body}
    </Link>
  )
}

/** "Age" cell: the shared Age / Date Time (UTC) cell, switched by the site-wide preference. */
export { AgeCell as Age } from './tables'
