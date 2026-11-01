import Link from 'next/link'
import { ToolCard, ToolsLayout } from '@/components/tools-layout'
import { api } from '@/lib/api'
import { EXPORT_TYPES, isExportError, isExportType, type ExportError, type ExportType } from '@/lib/export'
import { num } from '@/lib/format'
import { one, type SP } from '@/lib/page'

export const metadata = { title: 'Download Data (CSV Export)' }

const DAY_MS = 86_400_000

const MESSAGES: Record<ExportError, (limit: number) => string> = {
  type: () => 'Choose what to export.',
  address: () => 'Enter a valid address: 0x followed by 40 hexadecimal characters.',
  dates: () => 'Choose a start date and an end date, the end date not before the start date.',
  limit: (limit) => `This range holds ${num(limit)} records or more, too many for one file. Choose a shorter range.`,
  token: () => 'This address is not an ERC-20 token contract. Token exports need the token’s contract address.',
}

const GROUPS: { label: string; of: 'address' | 'token' }[] = [
  { label: 'Address', of: 'address' },
  { label: 'Token', of: 'token' },
]

/** Etherscan's "Download Data (CSV Export)": pick a kind, an address and a date range; the file comes from /exportData/csv. */
export default async function ExportData({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const typeParam = one(sp, 'type')
  const type: ExportType = typeParam !== undefined && isExportType(typeParam) ? typeParam : 'address'
  const errorParam = one(sp, 'error')
  const error = errorParam !== undefined && isExportError(errorParam) ? errorParam : null
  const a = one(sp, 'a')
  const start = one(sp, 'start')
  const end = one(sp, 'end')
  const now = Date.now()
  const today = new Date(now).toISOString().slice(0, 10)
  const monthAgo = new Date(now - 30 * DAY_MS).toISOString().slice(0, 10)
  const { limit } = await api.csvConfig()

  return (
    <ToolsLayout
      active="exportData"
      title="Download Data (CSV Export)"
      intro="The information you requested can be downloaded from this page. Choose what to export, the address and the date range, then press Download."
    >
      {/* Keyed by the query: the fields take their defaults only when mounted, so Reset (a link here) must remount them. */}
      <form key={JSON.stringify(sp)} action="/exportData/csv" method="get">
        <ToolCard
          footer={
            <>
              <button type="submit" className="btn btn-primary tl-btn">
                Download
              </button>
              <Link href="/exportData" className="btn tl-ghost tl-btn">
                Reset
              </Link>
            </>
          }
        >
          {error !== null && (
            <div className="alert alert-danger py-2" role="alert">
              {MESSAGES[error](limit)}
            </div>
          )}
          <div className="row tl-field">
            <div className="col-xl-6">
              <label htmlFor="export-type" className="form-label">
                Select export type
              </label>
              <select id="export-type" name="type" className="form-select" defaultValue={type}>
                {GROUPS.map((g) => (
                  <optgroup key={g.of} label={g.label}>
                    {(Object.keys(EXPORT_TYPES) as ExportType[])
                      .filter((k) => EXPORT_TYPES[k].of === g.of)
                      .map((k) => (
                        <option key={k} value={k}>
                          {EXPORT_TYPES[k].label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
          <div className="row tl-field">
            <div className="col-xl-6">
              <label htmlFor="export-address" className="form-label">
                Address <span className="text-danger">*</span>
              </label>
              <input
                id="export-address"
                name="a"
                className="form-control"
                placeholder="0x.."
                required
                pattern="0x[0-9a-fA-F]{40}"
                title="0x followed by 40 hexadecimal characters"
                defaultValue={a}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="tl-tip">For a Token export, the token’s contract address.</p>
            </div>
          </div>
          <div className="row g-3 tl-field">
            <div className="col-sm-6 col-xl-3">
              <label htmlFor="export-start" className="form-label">
                Start Date <span className="text-danger">*</span>
              </label>
              <input id="export-start" name="start" type="date" className="form-control" required max={today} defaultValue={start === undefined ? monthAgo : start} />
            </div>
            <div className="col-sm-6 col-xl-3">
              <label htmlFor="export-end" className="form-label">
                End Date <span className="text-danger">*</span>
              </label>
              <input id="export-end" name="end" type="date" className="form-control" required max={today} defaultValue={end === undefined ? today : end} />
            </div>
          </div>
          <p className="tl-tip tl-field">
            Both dates are whole days in UTC. Records are exported oldest first, at most {num(limit)} in one file. Token Holders
            lists every current holder and does not use the dates.
          </p>
        </ToolCard>
      </form>
    </ToolsLayout>
  )
}
