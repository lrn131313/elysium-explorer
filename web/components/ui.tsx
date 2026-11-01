import { CircleCheck, CircleHelp, CircleX, Clock3, Inbox, Lightbulb, MoveRight } from 'lucide-react'
import Link from 'next/link'

export function PageHead({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="ex-page-head d-flex flex-wrap align-items-center gap-2">
      <h1 className="ex-page-title">{title}</h1>
      {children}
    </div>
  )
}

/**
 * One "label: value" row of a details card, with the help icon the reference site puts before each label. `after`
 * follows the colon (Etherscan's count badge on "ERC-20 Tokens Transferred: (2)").
 */
export function Row({ label, help, after, children }: { label: string; help?: string; after?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="ex-dl-row">
      <div className="ex-dt">
        <span title={help ?? label} className="ex-help">
          <CircleHelp size={14} />
        </span>
        {label}:{after}
      </div>
      <div className="ex-dd">{children}</div>
    </div>
  )
}

export const Hr = () => <hr className="ex-hr" />

export function StatusBadge({ status }: { status: 'ok' | 'error' | null }) {
  if (status === 'ok')
    return (
      <span className="ex-badge ex-badge-success">
        <CircleCheck size={13} /> Success
      </span>
    )
  if (status === 'error')
    return (
      <span className="ex-badge ex-badge-danger">
        <CircleX size={13} /> Failed
      </span>
    )
  return (
    <span className="ex-badge ex-badge-warning">
      <Clock3 size={13} /> Pending
    </span>
  )
}

/** Etherscan's method badge wording: `swapExactETHForTokens` reads "Swap Exact ETH For Tokens". */
export function methodLabel(name: string): string {
  if (name.startsWith('0x')) return name // unknown selector, shown raw as Etherscan does
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The Action badge. A null name is a plain coin transfer ("Transfer"); callers pass the input's first 4 bytes for a creation. */
export function Method({ name }: { name: string | null }) {
  const pretty = name === null ? 'Transfer' : methodLabel(name)
  return (
    <span className="ex-method" title={pretty} data-hl={`m:${pretty}`}>
      {pretty}
    </span>
  )
}

/** The green circled arrow Etherscan puts between From and To when the list is not about one address. */
export function FlowArrow() {
  return (
    <span className="ex-flow" aria-hidden="true">
      <MoveRight size={12} strokeWidth={2.25} />
    </span>
  )
}

export function InOut({ from, to, me }: { from: string; to: string | null; me: string }) {
  const m = me.toLowerCase()
  const f = from.toLowerCase() === m
  const t = to?.toLowerCase() === m
  if (f && t) return <span className="ex-inout ex-self">SELF</span>
  if (f) return <span className="ex-inout ex-out">OUT</span>
  return <span className="ex-inout ex-in">IN</span>
}

/**
 * Link-based tabs (server-rendered; each tab is its own URL so it can be shared). `check` puts Etherscan's small
 * green tick on the pill's top-right corner (the Contract tab of a verified contract).
 */
export function Tabs({ tabs, active }: { tabs: { key: string; label: string; href: string; check?: boolean }[]; active: string }) {
  return (
    <div className="ex-pills mb-3">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={`ex-pill${t.key === active ? ' active' : ''}`} scroll={false}>
          {t.label}
          {t.check && (
            <span className="ex-pill-check" title="Verified">
              <CircleCheck size={14} fill="currentColor" />
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}

/** Etherscan's empty list: a pale yellow inbox circle, "There are no matching entries", "Please try again later". */
export function Empty({ title = 'There are no matching entries', children = 'Please try again later' }: { title?: string; children?: React.ReactNode }) {
  return (
    <div className="ex-empty">
      <span className="ex-empty-icon">
        <Inbox size={22} />
      </span>
      <h3 className="ex-empty-title">{title}</h3>
      <p className="text-muted mb-0">{children}</p>
    </div>
  )
}

/** An empty table keeps its header row; the empty state fills one full-width cell under it. */
export function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="ex-empty-cell">
        <Empty />
      </td>
    </tr>
  )
}

/** The muted footnote with a lightbulb Etherscan puts under each page's content. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="ex-note">
      <Lightbulb size={13} className="flex-shrink-0" />
      <span>{children}</span>
    </p>
  )
}
