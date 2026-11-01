'use client'

import { ChevronDown, Coins, FileX } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

/** One token in the Token Holdings dropdown; every text is formatted on the server (amounts exact). */
export interface HoldingRow {
  key: string
  href: string
  icon: string | null
  name: string
  symbol: string | null
  /** "123,647.03042853 OMG" for a fungible token, "x3" for NFTs. */
  amount: string
  usd: string | null
  rate: string | null
}

export interface HoldingGroup {
  /** "ERC-20", "ERC-721", … */
  type: string
  /** The group's size as the header shows it: "24", or ">200" when the list was cut there. */
  size: string
  rows: HoldingRow[]
}

const matches = (r: HoldingRow, q: string) => r.name.toLowerCase().includes(q) || (r.symbol !== null && r.symbol.toLowerCase().includes(q))

/**
 * Etherscan's Token Holdings dropdown: the button reads the total ("$1.23 (24 Tokens)"); open, it lists the tokens by
 * standard under a "Search for Token Name" box, with "View All Holdings" at the bottom (the Assets tab).
 */
export function TokenHoldings({ total, count, groups, allHref }: { total: string | null; count: number; groups: HoldingGroup[]; allHref: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (e: MouseEvent) => {
      if (box.current && e.target instanceof Node && !box.current.contains(e.target)) setOpen(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const q = query.trim().toLowerCase()
  const shown = groups.map((g) => ({ ...g, rows: q === '' ? g.rows : g.rows.filter((r) => matches(r, q)) })).filter((g) => g.rows.length > 0)
  const tokens = `${count} Token${count === 1 ? '' : 's'}`

  return (
    <div className="address-holdings" ref={box}>
      <button type="button" className="btn btn-white address-holdings-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="text-truncate">
          {total === null ? (
            tokens
          ) : (
            <>
              {total} <span className="small text-muted">({tokens})</span>
            </>
          )}
        </span>
        <ChevronDown size={14} className="flex-shrink-0" />
      </button>
      {open && (
        <div className="address-holdings-panel">
          <div className="p-3">
            <input
              type="text"
              className="form-control address-holdings-search"
              placeholder="Search for Token Name"
              aria-label="Search for Token Name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="address-holdings-list">
            {shown.length === 0 && (
              <div className="text-center py-4">
                <span className="address-holdings-none">
                  <FileX size={20} />
                </span>
                <p className="text-muted mb-0">Could not find any matches!</p>
              </div>
            )}
            {shown.map((g) => (
              <div key={g.type}>
                <div className="address-holdings-group">
                  {g.type} Tokens ({q === '' ? g.size : g.rows.length})
                </div>
                {g.rows.map((r) => (
                  <Row key={r.key} r={r} />
                ))}
              </div>
            ))}
          </div>
          <Link href={allHref} className="address-holdings-all" onClick={() => setOpen(false)}>
            <Coins size={13} /> View All Holdings
          </Link>
        </div>
      )}
    </div>
  )
}

/** One token: icon, "Name (SYM)" and the amount on the left; its worth and price on the right. */
function Row({ r }: { r: HoldingRow }) {
  return (
    <Link href={r.href} className="address-holdings-row">
      <span className="address-holdings-left">
        <span className="d-flex align-items-center gap-1">
          {r.icon === null ? <span className="address-holdings-icon" aria-hidden="true" /> : <img src={r.icon} width={14} height={14} className="address-holdings-icon" alt="" />}
          <span className="text-truncate" title={r.symbol === null ? r.name : `${r.name} (${r.symbol})`}>
            {r.name}
            {r.symbol !== null && ` (${r.symbol})`}
          </span>
        </span>
        <span className="d-block text-muted text-truncate">{r.amount}</span>
      </span>
      <span className="text-end flex-shrink-0">
        {r.usd !== null && <span className="d-block">{r.usd}</span>}
        {r.rate !== null && <span className="d-block small text-muted">@{r.rate}</span>}
      </span>
    </Link>
  )
}
