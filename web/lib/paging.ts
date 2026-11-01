// Etherscan-style list paging over Blockscout's keyset pages: "First ‹ Page X of N › Last" and "Show N Records".
//
// Blockscout only pages forward (each reply carries the cursor for the next page). Two ways around that:
// - "jump" lists can turn any page number into a cursor (a legacy-API lookup or plain arithmetic), so their URLs carry
//   only `p` and `ps`, exactly like Etherscan's, and every pager button works.
// - "walk" lists cannot; their URL carries `c`, the cursors of every page walked so far (base64url JSON), so "‹" can
//   step back. Their "Last" stays disabled.
import { notFound } from 'next/navigation'
import { one, type SP } from './page'
import type { PageParams } from './types'

export const PAGE_SIZES = [10, 25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]

export type Cursor = Record<string, string | number | boolean | null>

/** `ps` from the URL; absent means the list's own default, anything outside 10/25/50/100 is a bad URL. */
export function pageSizeFrom(sp: SP, fallback: PageSize): PageSize {
  const raw = one(sp, 'ps')
  if (raw === undefined) return fallback
  const size = PAGE_SIZES.find((s) => String(s) === raw)
  if (size === undefined) notFound()
  return size
}

/** `p` from the URL (jump lists): a whole number from 1; anything else is a bad URL. */
export function pageFrom(sp: SP): number {
  const raw = one(sp, 'p')
  if (raw === undefined) return 1
  if (!/^[1-9]\d{0,6}$/.test(raw)) notFound()
  return Number(raw)
}

const isCursor = (v: unknown): v is Cursor =>
  typeof v === 'object' &&
  v !== null &&
  !Array.isArray(v) &&
  Object.values(v).every((x) => x === null || ['string', 'number', 'boolean'].includes(typeof x))

/** `c` from the URL (walk lists): the cursors of pages 2..p. A value that does not decode to that is a bad URL. */
export function stackFrom(sp: SP): Cursor[] {
  const raw = one(sp, 'c')
  if (raw === undefined) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  } catch (e) {
    // A hand-edited or truncated link: JSON.parse throws SyntaxError on it. Treat it like any other bad URL.
    if (e instanceof SyntaxError) notFound()
    throw e
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isCursor)) notFound()
  return parsed
}

const encodeStack = (stack: Cursor[]) => Buffer.from(JSON.stringify(stack)).toString('base64url')

/** Blockscout's next-page params minus `items_count`, which it does not echo back and we send ourselves. */
export function toCursor(next: PageParams): Cursor {
  const out: Cursor = {}
  for (const [k, v] of Object.entries(next)) if (k !== 'items_count') out[k] = v
  return out
}

export interface Nav {
  page: number
  /** Total pages, when the list has a total; at least one past the current page while Blockscout says there is more. */
  pages: number | null
  first: string | null
  prev: string | null
  next: string | null
  last: string | null
  sizes: { size: PageSize; href: string }[]
  size: PageSize
}

interface Base {
  base: string
  keep: Record<string, string>
  size: PageSize
  defaultSize: PageSize
  total: number | null
}

function href(b: Base, size: PageSize, extra: Record<string, string>): string {
  const q = new URLSearchParams(b.keep)
  if (size !== b.defaultSize) q.set('ps', String(size))
  for (const [k, v] of Object.entries(extra)) q.set(k, v)
  const s = q.toString()
  return s ? `${b.base}?${s}` : b.base
}

function pageCount(total: number | null, size: number, page: number, hasNext: boolean): number | null {
  if (!hasNext) return page
  if (total === null) return null
  return Math.max(Math.ceil(total / size), page + 1)
}

const sizesFor = (b: Base) => PAGE_SIZES.map((size) => ({ size, href: href(b, size, {}) }))

/** A list that can open any page by number. */
export function jumpNav(b: Base & { page: number; hasNext: boolean }): Nav {
  const pages = pageCount(b.total, b.size, b.page, b.hasNext)
  const at = (p: number) => (p === 1 ? href(b, b.size, {}) : href(b, b.size, { p: String(p) }))
  return {
    page: b.page,
    pages,
    first: b.page > 1 ? at(1) : null,
    prev: b.page > 1 ? at(b.page - 1) : null,
    next: b.hasNext ? at(b.page + 1) : null,
    last: b.hasNext && pages !== null ? at(pages) : null,
    sizes: sizesFor(b),
    size: b.size,
  }
}

/** A list Blockscout can only walk forward: `stack` holds the cursors that led to this page. */
export function walkNav(b: Base & { stack: Cursor[]; next: PageParams | null }): Nav {
  const page = b.stack.length + 1
  const at = (stack: Cursor[]) => (stack.length === 0 ? href(b, b.size, {}) : href(b, b.size, { c: encodeStack(stack) }))
  return {
    page,
    pages: pageCount(b.total, b.size, page, b.next !== null),
    first: page > 1 ? at([]) : null,
    prev: page > 1 ? at(b.stack.slice(0, -1)) : null,
    next: b.next ? at([...b.stack, toCursor(b.next)]) : null,
    last: null,
    sizes: sizesFor(b),
    size: b.size,
  }
}

/** The params for a walk list's current page: its own cursor (if past page 1) and the page size. */
export function walkParams(stack: Cursor[], size: PageSize): PageParams {
  const cur = stack.at(-1)
  return cur === undefined ? { items_count: size } : { ...cur, items_count: size }
}
