'use client'

import { useState } from 'react'

/**
 * Etherscan's "All Transfers / Net Transfers" switch above a transaction's transfer list. Both lists arrive
 * server-rendered; the switch only picks which one shows.
 */
export function TransferViews({ all, net }: { all: React.ReactNode; net: React.ReactNode }) {
  const [view, setView] = useState<'all' | 'net'>('all')
  return (
    <div>
      <div className="ex-tview" role="group" aria-label="Transfers view">
        <button type="button" className={`ex-tview-btn${view === 'all' ? ' active' : ''}`} aria-pressed={view === 'all'} onClick={() => setView('all')}>
          All Transfers
        </button>
        <button type="button" className={`ex-tview-btn${view === 'net' ? ' active' : ''}`} aria-pressed={view === 'net'} onClick={() => setView('net')}>
          Net Transfers
        </button>
      </div>
      {view === 'all' ? all : net}
    </div>
  )
}
