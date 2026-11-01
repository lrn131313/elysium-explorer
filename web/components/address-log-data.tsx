'use client'

import { useState } from 'react'

/**
 * The data box of one event log, as Etherscan's Events tab shows it: the decoded values ("Dec") or the raw 32-byte
 * words ("Hex"). Both views are rendered on the server; this only switches between them.
 */
export function LogData({ dec, hex }: { dec: React.ReactNode; hex: React.ReactNode }) {
  const [view, setView] = useState<'dec' | 'hex'>('dec')
  return (
    <div>
      <div className="btn-group btn-group-sm mb-1" role="group" aria-label="Data view">
        <button type="button" className={`btn btn-white address-log-switch${view === 'dec' ? ' active' : ''}`} aria-pressed={view === 'dec'} onClick={() => setView('dec')}>
          Dec
        </button>
        <button type="button" className={`btn btn-white address-log-switch${view === 'hex' ? ' active' : ''}`} aria-pressed={view === 'hex'} onClick={() => setView('hex')}>
          Hex
        </button>
      </div>
      <div className="address-log-box">{view === 'dec' ? dec : hex}</div>
    </div>
  )
}
