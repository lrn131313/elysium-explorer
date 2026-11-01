'use client'

import { Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { FILTER_LABEL, parseFilter, SEARCH_FILTERS, SEARCH_PLACEHOLDER, type SearchFilter } from '@/lib/chrome-search'

/** The search box's submit: /search jumps straight to an address, transaction or block, else lists the matches. */
function useSearch(filter: SearchFilter) {
  const router = useRouter()
  return (q: string) => {
    const v = q.trim()
    if (!v) return
    router.push(`/search?q=${encodeURIComponent(v)}${filter === 'all' ? '' : `&f=${filter}`}`)
  }
}

/** The topbar search (Etherscan's #frmMaster): search icon, clear "x", and "/" focuses it from anywhere. */
export function CompactSearch() {
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const go = useSearch('all')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      const typing = t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <form
      className="ex-topsearch"
      action="/search"
      method="get"
      role="search"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault()
        go(q)
      }}
    >
      <span className="ex-topsearch-icon" aria-hidden="true">
        <Search size={18} />
      </span>
      <input
        ref={input}
        name="q"
        type="text"
        className="form-control form-control-lg"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={SEARCH_PLACEHOLDER}
        aria-label="Search"
        maxLength={68}
        spellCheck={false}
      />
      {q !== '' && (
        <button
          type="button"
          className="ex-topsearch-clear"
          aria-label="Clear search"
          onClick={() => {
            setQ('')
            input.current?.focus()
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
      <span className="ex-topsearch-key d-none d-sm-flex" title="Press / to search">
        <kbd className="ex-kbd">/</kbd>
      </span>
    </form>
  )
}

/** The home page hero search: filter, field, clear "x" and the blue button (Etherscan's .search-panel-container). */
export function HeroSearch() {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<SearchFilter>('all')
  const input = useRef<HTMLInputElement>(null)
  const go = useSearch(filter)

  return (
    <form
      className="ex-search"
      action="/search"
      method="get"
      role="search"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault()
        go(q)
      }}
    >
      <div className="d-none d-sm-block">
        <select name="f" value={filter} onChange={(e) => setFilter(parseFilter(e.target.value))} aria-label="Search filter" className="h-100">
          {SEARCH_FILTERS.map((f) => (
            <option key={f} value={f}>
              {FILTER_LABEL[f]}
            </option>
          ))}
        </select>
      </div>
      <div className="ex-search-field">
        <input
          ref={input}
          name="q"
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER}
          aria-label="Search"
          maxLength={68}
          spellCheck={false}
        />
        {q !== '' && (
          <button
            type="button"
            className="ex-search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQ('')
              input.current?.focus()
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      <button type="submit" className="btn btn-primary ex-search-btn" aria-label="Search">
        <Search size={16} aria-hidden="true" />
      </button>
    </form>
  )
}
