'use client'
// The chain team's interactive bits: the Gas Tracker's refresh countdown and its custom gas limit row.

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { gasUsd } from './chain-format'

/**
 * Etherscan's "Next update in 10s": counts down, then re-renders the page's server components and starts again. A
 * hidden tab waits at 0 until it is shown again, so a tab left open in the background costs nothing.
 */
export function RefreshCountdown({ seconds }: { seconds: number }) {
  const router = useRouter()
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    const id = setInterval(() => {
      setLeft((s) => (s > 0 ? s - 1 : s))
    }, 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (left > 0) return
    const go = () => {
      if (document.visibilityState !== 'visible') return
      router.refresh()
      setLeft(seconds)
    }
    go()
    document.addEventListener('visibilitychange', go)
    return () => document.removeEventListener('visibilitychange', go)
  }, [left, router, seconds])
  return <span suppressHydrationWarning>{left}s</span>
}

/** One price tier: gas price in wei (decimal string; BigInt does not cross to the browser) and its column. */
interface Tier {
  key: string
  wei: string
}

const MAX_GAS = 1_000_000_000

/** Featured Actions' last row: type a gas limit, see what it costs at each tier. */
export function CustomGasRow({ tiers, rate }: { tiers: Tier[]; rate: number | null }) {
  const [raw, setRaw] = useState('')
  const gas = /^\d{1,10}$/.test(raw) && Number(raw) > 0 && Number(raw) <= MAX_GAS ? Number(raw) : null
  return (
    <tr>
      <td>
        <input
          className="form-control form-control-sm chain-gas-input"
          inputMode="numeric"
          placeholder="Custom Gas Limit"
          aria-label="Custom Gas Limit"
          title="Estimated based on Gas Limit entered by user."
          value={raw}
          onChange={(e) => setRaw(e.target.value.trim())}
        />
      </td>
      {tiers.map((t) => (
        <td key={t.key}>{gas === null || rate === null ? '-' : gasUsd(gas, t.wei, rate)}</td>
      ))}
    </tr>
  )
}
