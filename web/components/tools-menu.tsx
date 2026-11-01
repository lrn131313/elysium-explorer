'use client'

import { Menu } from 'lucide-react'
import { useState } from 'react'

/** The tools sidebar's "Tools Menu" button: below 992px the menu stays folded until it is pressed (Etherscan's collapse). */
export function ToolsMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="d-lg-none mb-2">
        <button
          type="button"
          className="btn btn-white d-inline-flex align-items-center gap-1"
          aria-expanded={open}
          aria-controls="tools-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <Menu size={14} />
          Tools Menu
        </button>
      </div>
      <nav id="tools-menu" className={`tl-menu${open ? ' open' : ''}`} aria-label="Tools">
        {children}
      </nav>
    </>
  )
}
