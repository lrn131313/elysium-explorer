'use client'

import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * Etherscan's small white dropdown button (the Transactions tab's filter funnel, the header's "more" menu): the button
 * shows `label` and a chevron; the menu holds the server-rendered `children` (links) and closes on a click outside,
 * on Escape, or when an item is chosen.
 */
export function AddressMenu({ label, title, children }: { label: React.ReactNode; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
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
  return (
    <div className="address-menu" ref={box}>
      <button
        type="button"
        className="btn btn-sm btn-white d-inline-flex align-items-center gap-1"
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <ChevronDown size={13} />
      </button>
      <div className="address-menu-panel" role="menu" hidden={!open} onClick={() => setOpen(false)}>
        {children}
      </div>
    </div>
  )
}
