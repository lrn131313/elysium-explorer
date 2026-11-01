import { ChevronLeft, ChevronRight, Download, MoveRight } from 'lucide-react'
import Link from 'next/link'
import type { Sheet } from '@/lib/csv'
import type { ExportType } from '@/lib/export'
import { counted, num } from '@/lib/format'
import type { Nav } from '@/lib/paging'
import { DownloadPageData, PageSizeSelect } from './client'

/** Etherscan's "[ Download: CSV Export ]" under a list: opens the export form for this address or token. */
export function CsvExportLine({ type, a }: { type: ExportType; a: string }) {
  return (
    <div className="ex-csv-line">
      [&nbsp;Download:{' '}
      <Link href={`/exportData?type=${type}&a=${a}`} className="fw-medium" title="Export records in CSV format">
        CSV Export
      </Link>{' '}
      <Download size={12} />
      &nbsp;]
    </div>
  )
}

/** The right side of a full list's header line on Etherscan: "Download Page Data", then the pager. */
export function ListTools({ sheet, nav }: { sheet: Sheet; nav: Nav }) {
  return (
    <>
      <DownloadPageData sheet={sheet} />
      <NavPager nav={nav} />
    </>
  )
}

/** The line above a list: what it holds and how many (left), the list's buttons (right). No border under it. */
export function ListHead({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="card-header ex-list-head">
      <div className="ex-list-info">{children}</div>
      {right && <div className="d-flex flex-wrap align-items-center gap-2">{right}</div>}
    </div>
  )
}

function Item({ href, label, title, children }: { href: string | null; label: string; title?: string; children: React.ReactNode }) {
  return href ? (
    <Link href={href} className="ex-page-link" aria-label={label} title={title} scroll={false}>
      {children}
    </Link>
  ) : (
    <span className="ex-page-link disabled" aria-disabled="true" aria-label={label}>
      {children}
    </span>
  )
}

/** First | ‹ | Page X of N | › | Last. "of N" is left out when the list has no total. */
export function NavPager({ nav }: { nav: Nav }) {
  return (
    <nav className="ex-pagination" aria-label="Pagination">
      <Item href={nav.first} label="First">
        First
      </Item>
      <Item href={nav.prev} label="Previous" title="Go to Previous">
        <ChevronLeft size={14} />
      </Item>
      <span className="ex-page-link disabled">
        Page {num(nav.page)}
        {nav.pages !== null && ` of ${num(nav.pages)}`}
      </span>
      <Item href={nav.next} label="Next" title="Go to Next">
        <ChevronRight size={14} />
      </Item>
      <Item href={nav.last} label="Last">
        Last
      </Item>
    </nav>
  )
}

/**
 * The count line of a list Blockscout has no total for: "More than N … found" while more pages follow (N = the rows
 * walked so far), "A total of N … found" once the last page is reached and the count is exact.
 */
export function WalkCount({ walked, rows, more, noun }: { walked: number; rows: number; more: boolean; noun: string }) {
  return (
    <>
      {more ? 'More than' : 'A total of'} {counted(walked + rows, noun)} found
    </>
  )
}

/** The whole-width "VIEW ALL TRANSACTIONS →" footer under an address tab's latest rows; it opens the full list. */
export function ViewAll({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="card-footer ex-viewall">
      {children}
      <MoveRight size={14} />
    </Link>
  )
}

/** Under a paged list: "Show [N] Records" on the left, the pager on the right. */
export function ListFoot({ nav }: { nav: Nav }) {
  return (
    <div className="card-footer ex-list-foot">
      <div className="d-flex align-items-center gap-2 text-nowrap text-muted">
        Show:
        <PageSizeSelect sizes={nav.sizes} size={nav.size} />
        Records
      </div>
      <NavPager nav={nav} />
    </div>
  )
}
