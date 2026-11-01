'use client'

import { Check, Copy as CopyIcon, Download, Minus, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toCsv, type Sheet } from '@/lib/csv'
import { age } from '@/lib/format'
import { guardedCopy } from './chrome-lookalike'

/** Etherscan's "Download Page Data": saves the rows on screen as a CSV file; nothing is fetched. */
export function DownloadPageData({ sheet }: { sheet: Sheet }) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-white text-nowrap d-inline-flex align-items-center gap-1"
      onClick={() => {
        // A UTF-8 byte-order mark makes Excel read names with accents or symbols correctly.
        const blob = new Blob(['﻿', toCsv(sheet)], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = sheet.name
        link.click()
        URL.revokeObjectURL(url)
      }}
    >
      <Download size={13} className="text-muted" />
      Download Page Data
    </button>
  )
}

/** Etherscan's "Show [10/25/50/100] Records": the server supplies each size's link; choosing one opens it. */
export function PageSizeSelect({ sizes, size }: { sizes: { size: number; href: string }[]; size: number }) {
  const router = useRouter()
  return (
    <select
      className="form-select form-select-sm ex-size-select"
      aria-label="Records per page"
      value={String(size)}
      onChange={(e) => {
        const pick = sizes.find((s) => String(s.size) === e.target.value)
        if (pick) router.push(pick.href, { scroll: false })
      }}
    >
      {sizes.map((s) => (
        <option key={s.size} value={String(s.size)}>
          {s.size}
        </option>
      ))}
    </select>
  )
}

/** The display preferences Chrome's boot script copies onto <html> before paint (TEAM.md §3 "Display preferences"). */
const PREFS_KEY = 'ex:prefs'
export type ColumnPref = 'age' | 'amount' | 'fee'

function savePref(key: ColumnPref, value: string) {
  const raw = localStorage.getItem(PREFS_KEY)
  const prefs: Record<string, unknown> = {}
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) Object.assign(prefs, parsed)
    } catch (e) {
      // The stored text is not JSON (cut short or edited by hand): JSON.parse throws SyntaxError. It is replaced below.
      if (!(e instanceof SyntaxError)) throw e
    }
  }
  prefs[key] = value
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export interface ColumnVariant {
  /** The value stored under the pref key and set as `data-ex-<pref>`; cells of this variant carry `ex-v-<value>`. */
  value: string
  label: string
  title?: string
}

/**
 * Etherscan's blue column header that switches what a column shows (Age / Date Time (UTC), Amount / Value (USD),
 * Txn Fee / Gas Price). Both cell variants are in the page; CSS shows the one `<html data-ex-<pref>>` names, so a click
 * only flips that attribute and stores the choice.
 */
export function ColumnToggle({ pref, first, second }: { pref: ColumnPref; first: ColumnVariant; second: ColumnVariant }) {
  return (
    <button
      type="button"
      className="ex-th-toggle"
      onClick={() => {
        const root = document.documentElement
        const attr = `data-ex-${pref}`
        const next = root.getAttribute(attr) === second.value ? first.value : second.value
        root.setAttribute(attr, next)
        savePref(pref, next)
      }}
    >
      {[first, second].map((v) => (
        <span key={v.value} className={`ex-v-${v.value}`} title={v.title}>
          {v.label}
        </span>
      ))}
    </button>
  )
}

/** Live "x secs ago" that keeps counting in the browser. */
export function TimeAgo({ ts }: { ts: string }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  // Server and first client render use their own clocks; the seconds may differ, hence suppressHydrationWarning.
  return <span suppressHydrationWarning>{age(ts, now ?? Date.now())}</span>
}

/** Etherscan's copy glyph: grey, "Copy Address" / "Copy Transaction Hash" on hover, a tick and "Copied!" after. */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="ex-copy"
      title={done ? 'Copied!' : label}
      aria-label={label}
      onClick={() => {
        // A lookalike address asks first; "Copied!" shows only when the copy happened.
        void guardedCopy(text).then((copied) => {
          if (!copied) return
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }}
    >
      {done ? <Check size={14} /> : <CopyIcon size={14} />}
    </button>
  )
}

/**
 * Etherscan's "More Details: + Click to show more" card: the extra rows stay in the page (hidden), and the
 * whole bottom strip toggles them. Open, the rows sit above the strip with a divider between.
 */
export function MoreDetails({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card mb-3">
      <div id="more-details" className="ex-dl pb-0" hidden={!open}>
        {children}
        <hr className="ex-hr ex-hr-end" />
      </div>
      <button type="button" className="ex-more-toggle" aria-expanded={open} aria-controls="more-details" onClick={() => setOpen((o) => !o)}>
        <span className="ex-dl-row mb-0">
          <span className="ex-dt">More Details:</span>
          <span className="ex-dd">
            <span className="ex-more-link">
              {open ? <Minus size={14} /> : <Plus size={14} />} Click to show {open ? 'less' : 'more'}
            </span>
          </span>
        </span>
      </button>
    </div>
  )
}

/** Re-renders the server components every `seconds` (home page live feed). */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])
  return null
}
