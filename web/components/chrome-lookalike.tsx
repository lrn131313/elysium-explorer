'use client'

import { TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LOOKALIKE_CHARS, lookalikes, lookSignature } from '@/lib/chrome-lookalike'

// The page's current lookalike addresses and the guard's "ask the visitor" hook. Module state: there is one guard per
// page (mounted in the root layout), and guardedCopy() is called from copy buttons anywhere in the tree.
let flagged: ReadonlySet<string> = new Set()
let ask: ((address: string) => Promise<boolean>) | null = null

const enabled = () => document.documentElement.dataset.exLookalike === 'on'

/**
 * Copies `text` to the clipboard. When it is an address flagged as a lookalike on this page (and the warning is on),
 * the visitor confirms first. Resolves to whether it was copied, so a copy button only says "Copied!" when it was.
 */
export async function guardedCopy(text: string): Promise<boolean> {
  if (ask !== null && enabled() && flagged.has(text.toLowerCase())) {
    if (!(await ask(text))) return false
  }
  await navigator.clipboard.writeText(text)
  return true
}

const MARK_STYLE = 'text-decoration:underline wavy var(--ex-danger);text-decoration-thickness:1px;text-underline-offset:3px'

/**
 * Robin's "Lookalike Address Warning": watches the page's addresses (`data-hl`), underlines the ones that share their
 * first and last characters with another one, and asks before such an address is copied, by a copy button
 * (guardedCopy) or by selecting it and copying. The `lookalike` preference switches both off.
 */
export function LookalikeGuard() {
  const [flags, setFlags] = useState<string[]>([])
  const [pending, setPending] = useState<{ address: string; resolve: (ok: boolean) => void } | null>(null)

  useEffect(() => {
    let frame = 0
    let last = ''
    const scan = () => {
      frame = 0
      const values = Array.from(document.querySelectorAll<HTMLElement>('[data-hl]')).flatMap((el) => (el.dataset.hl === undefined ? [] : [el.dataset.hl]))
      const found = lookalikes(values)
      const key = found.join()
      if (key === last) return
      last = key
      flagged = new Set(found)
      setFlags(found)
    }
    // Pages change under us (client navigation, auto-refresh): rescan at most once per frame.
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(scan)
    }
    schedule()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-hl'] })

    ask = (address) => new Promise((resolve) => setPending({ address, resolve }))

    // Selecting a flagged address and pressing copy: hold the copy until the visitor confirms.
    const onCopy = (e: ClipboardEvent) => {
      if (ask === null || !enabled()) return
      const selection = document.getSelection()
      const text = selection === null ? '' : selection.toString()
      const hit = (text.toLowerCase().match(/0x[0-9a-f]{40}/g) ?? []).find((a) => flagged.has(a))
      if (hit === undefined) return
      e.preventDefault()
      void ask(hit).then((ok) => (ok ? navigator.clipboard.writeText(text) : undefined))
    }
    document.addEventListener('copy', onCopy)

    return () => {
      observer.disconnect()
      if (frame !== 0) cancelAnimationFrame(frame)
      document.removeEventListener('copy', onCopy)
      flagged = new Set()
      ask = null
    }
  }, [])

  useEffect(() => {
    if (pending === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        pending.resolve(false)
        setPending(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pending])

  const answer = (ok: boolean) => {
    if (pending === null) return
    pending.resolve(ok)
    setPending(null)
  }

  // Only lower-case hex addresses reach `flags` (lookalikes() filters them), so the selectors are safe to inline.
  const css = flags.length === 0 ? '' : `${flags.map((a) => `[data-ex-lookalike='on'] [data-hl="${a}"]`).join(',')}{${MARK_STYLE}}`
  const twins = pending === null ? [] : flags.filter((f) => f !== pending.address.toLowerCase() && lookSignature(f) === lookSignature(pending.address.toLowerCase()))

  return (
    <>
      {css !== '' && <style>{css}</style>}
      {pending !== null && (
        <>
          <div
            className="modal d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ex-lookalike-title"
            onClick={(e) => {
              // A click on the dimmed area around the dialog cancels, as Bootstrap's modal does.
              if (e.target === e.currentTarget) answer(false)
            }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-body text-center p-4">
                  <TriangleAlert size={36} className="ex-lookalike-icon mb-3" aria-hidden="true" />
                  <h2 id="ex-lookalike-title" className="h5">
                    Before You Copy
                  </h2>
                  <p className="text-muted small font-mono text-break">{pending.address}</p>
                  <p>
                    This address shares its first and last {LOOKALIKE_CHARS} characters with{' '}
                    {twins.length === 1 ? 'another address' : `${twins.length} other addresses`} on this page:
                  </p>
                  {twins.map((t) => (
                    <p key={t} className="text-muted small font-mono text-break">
                      {t}
                    </p>
                  ))}
                  <p>Scammers create lookalike addresses so that the wrong one gets copied. Compare the full address before you use it.</p>
                  <div className="d-grid gap-2">
                    <button type="button" className="btn btn-lg btn-secondary" onClick={() => answer(true)} autoFocus>
                      Understand, Copy Address
                    </button>
                    <button type="button" className="btn btn-white" onClick={() => answer(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      )}
    </>
  )
}
