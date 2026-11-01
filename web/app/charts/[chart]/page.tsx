import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DailyChart } from '@/components/chain-chart'
import { DownloadPageData } from '@/components/client'
import { Empty, Note, PageHead } from '@/components/ui'
import type { Sheet } from '@/lib/csv'
import { CHARTS, isChartSlug, type ChartSlug } from '../series'

type Params = Promise<{ chart: string }>

async function slugFrom(params: Params): Promise<ChartSlug> {
  const { chart } = await params
  if (!isChartSlug(chart)) notFound()
  return chart
}

export async function generateMetadata({ params }: { params: Params }) {
  return { title: CHARTS[await slugFrom(params)].title }
}

/** "7/30/2015": the date column of Etherscan's chart CSV files. */
function csvDay(date: string): string {
  const [y, m, d] = date.split('-')
  return `${Number(m)}/${Number(d)}/${y}`
}

/** Etherscan's /chart/<name>: one daily chart, its numbers as a table and a CSV file. */
export default async function ChartPage({ params }: { params: Params }) {
  const slug = await slugFrom(params)
  const def = CHARTS[slug]
  const points = await def.load()
  const sheet: Sheet = {
    name: `export-${slug}.csv`,
    header: ['Date(UTC)', 'UnixTimeStamp', def.unit],
    rows: points.map((p) => [csvDay(p.date), String(Date.parse(`${p.date}T00:00:00Z`) / 1000), p.csv]),
  }
  const first = points[0]
  const last = points.at(-1)
  return (
    <div className="container-xxl">
      <PageHead title={def.title}>
        <Link href="/charts" className="small">
          Charts &amp; Stats
        </Link>
      </PageHead>
      <div className="card mb-3">
        <div className="card-body">
          <p className="text-muted mb-3">{def.about}</p>
          {first === undefined || last === undefined ? (
            <Empty title="There is no data for this chart yet" />
          ) : (
            <>
              <DailyChart points={points} axis={def.axis} zero={def.zero} label={`${def.title}, ${first.date} to ${last.date}`} />
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
                <span className="small text-muted">
                  {first.date} to {last.date} (UTC), {points.length} days
                </span>
                <DownloadPageData sheet={sheet} />
              </div>
            </>
          )}
        </div>
      </div>
      {points.length > 0 && (
        <details className="card mb-3 chain-data-table">
          <summary className="card-header">Chart data as a table</summary>
          <div className="ex-table-wrap">
            <table className="ex-table">
              <thead>
                <tr>
                  <th>Date (UTC)</th>
                  <th>{def.unit}</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.date}>
                    <td>{p.date}</td>
                    <td>{p.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <Note>Source: {def.source}</Note>
    </div>
  )
}
