'use client'

import { useEffect } from 'react'

const MARK = 'ex-hl-on'

/**
 * Etherscan's "Address and Method Highlight": hovering an element with `data-hl` marks every element on the page with
 * the same value (addresses lower-cased, methods as `m:<name>`). One listener on the document covers every page, and
 * the `highlight` preference (<html data-ex-highlight>) switches it off. The look of `[data-hl].ex-hl-on` is in
 * app/styles/lists.css. Renders nothing.
 */
export function Highlighter() {
  useEffect(() => {
    let current: string | null = null
    let marked: Element[] = []

    const clear = () => {
      for (const el of marked) el.classList.remove(MARK)
      marked = []
      current = null
    }

    const onOver = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-hl]') : null
      const value = el === null ? null : el.dataset.hl
      if (value === current) return
      clear()
      if (!value || document.documentElement.dataset.exHighlight !== 'on') return
      current = value
      marked = Array.from(document.querySelectorAll(`[data-hl="${CSS.escape(value)}"]`))
      for (const m of marked) m.classList.add(MARK)
    }

    // The pointer leaving the window (no element to go to) ends the hover too.
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget === null) clear()
    }

    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    return () => {
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      clear()
    }
  }, [])
  return null
}
