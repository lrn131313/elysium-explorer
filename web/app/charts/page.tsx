import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Help, StatTile } from '@/components/chain-cells'
import { Sparkline } from '@/components/chain-chart'
import { smallUsd } from '@/components/chain-format'
import { PageHead } from '@/components/ui'
import { api } from '@/lib/api'
import { contractCounters, txStats } from '@/lib/chain-api'
import { formatUnits, num, usd } from '@/lib/format'
import { SITE } from '@/lib/site'
import { CHARTS, type ChartSlug, type SeriesPoint } from './series'

export const metadata = { title: `${SITE.chainName} Charts and Statistics` }

const SECTIONS = [
  { key: 'market', id: 'section-market-data', title: 'Market Data' },
  { key: 'blockchain', id: 'section-blockchain-data', title: 'Blockchain Data' },
  { key: 'network', id: 'section-network-data', title: 'Network Data' },
] as const

const SLUGS = Object.keys(CHARTS) as ChartSlug[]

function ChartCard({ slug, points, current }: { slug: ChartSlug; points: SeriesPoint[]; current: string | null }) {
  const def = CHARTS[slug]
  return (
    <div className="col-sm-6">
      <div className="card h-100">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
            <div>
              <h3 className="h6 fw-normal mb-1 d-inline-flex align-items-center gap-1">
                {def.card} (30D) <Help tip={def.about} />
              </h3>
              {current !== null && <div className="fw-medium">{current}</div>}
            </div>
            <Link href={`/charts/${slug}`} className="text-nowrap d-inline-flex align-items-center">
              View <ChevronRight size={14} />
            </Link>
          </div>
          {points.length === 0 ? <p className="text-muted small mb-0">No data yet.</p> : <Sparkline points={points} zero={def.zero} label={`${def.card}, last 30 days`} />}
        </div>
      </div>
    </div>
  )
}

/** Etherscan's /charts: headline figures, then a card per chart this chain has data for. */
export default async function Charts() {
  const [stats, tx24, contracts, ...series] = await Promise.all([
    api.stats(),
    txStats(),
    contractCounters(),
    ...SLUGS.map((s) => CHARTS[s].load()),
  ])
  const pointsOf = new Map(SLUGS.map((s, i) => [s, series[i]]))
  const rate = stats.coin_price === null ? null : Number(stats.coin_price)
  const current: Partial<Record<ChartSlug, string>> = {}
  if (rate !== null) current.hypeprice = usd(rate)
  if (stats.market_cap !== null) current.marketcap = usd(Number(stats.market_cap))
  const avgFee = BigInt(tx24.transaction_fees_avg_24h)
  return (
    <div className="container-xxl">
      <PageHead title={`${SITE.chainName} Charts & Statistics`} />
      <div className="row gx-lg-5">
        <div className="col-lg-3 col-xl-2 border-end d-none d-lg-block">
          <nav className="chain-side-nav nav flex-column gap-1" aria-label="Sections">
            <a className="nav-link" href="#section-overview-stats">
              Overview Stats
            </a>
            {SECTIONS.map((s) => (
              <a key={s.id} className="nav-link" href={`#${s.id}`}>
                {s.title}
              </a>
            ))}
          </nav>
        </div>
        <div className="col-lg-9 col-xl-10">
          <section id="section-overview-stats" className="chain-section">
            <h2 className="fs-6 fw-medium mb-3">Overview Stats</h2>
            <div className="row g-2">
              <div className="col-sm-6 col-lg-3">
                <StatTile label="Addresses (Total)" tip="Every address Blockscout has seen on the chain." href="/accounts">
                  {num(stats.total_addresses)}
                </StatTile>
              </div>
              <div className="col-sm-6 col-lg-3">
                <StatTile label="Transactions (Total)" tip="All transactions recorded on the chain." href="/txs">
                  {num(stats.total_transactions)}
                </StatTile>
              </div>
              <div className="col-sm-6 col-lg-3">
                <StatTile label="Transactions (24h)" tip="Transactions recorded in the past 24 hours." href="/charts/tx">
                  {num(tx24.transactions_count_24h)}
                </StatTile>
              </div>
              <div className="col-sm-6 col-lg-3">
                <StatTile label="Total Transaction Fee (24h)" tip="All transaction fees paid in the past 24 hours." href="/charts/transactionfee">
                  {formatUnits(tx24.transaction_fees_sum_24h, 18, { maxFraction: 2 })} {SITE.coin}
                </StatTile>
              </div>
              <div className="col-sm-6 col-lg-3">
                <StatTile label="Avg. Transaction Fee (24h)" tip={`The average fee per transaction in the past 24 hours, in US dollars (${formatUnits(avgFee, 18)} ${SITE.coin}).`} href="/charts/avg-txfee-usd">
                  {rate === null ? `${formatUnits(avgFee, 18, { maxFraction: 9 })} ${SITE.coin}` : smallUsd((Number(avgFee) / 1e18) * rate)}
                </StatTile>
              </div>
              <div className="col-sm-6 col-lg-3">
                <StatTile label="Contracts Deployed (Total)" tip="All contracts created on the chain.">
                  {num(contracts.smart_contracts)}
                </StatTile>
              </div>
              <div className="col-sm-6 col-lg-3">
                <StatTile label="Contracts Deployed (24h)" tip="Contracts created in the past 24 hours.">
                  {num(contracts.new_smart_contracts_24h)}
                </StatTile>
              </div>
              <div className="col-sm-6 col-lg-3">
                <StatTile label="Contracts Verified (Total)" tip="Contracts whose source code has been verified." href="/contractsVerified">
                  {num(contracts.verified_smart_contracts)}
                </StatTile>
              </div>
              <div className="col-sm-6 col-lg-3">
                <StatTile label="Contracts Verified (24h)" tip="Contracts verified in the past 24 hours." href="/contractsVerified">
                  {num(contracts.new_verified_smart_contracts_24h)}
                </StatTile>
              </div>
            </div>
          </section>
          {SECTIONS.map((sec) => (
            <section key={sec.id} id={sec.id} className="chain-section">
              <h2 className="fs-6 fw-medium mb-3">{sec.title}</h2>
              <div className="row g-4">
                {SLUGS.filter((s) => CHARTS[s].section === sec.key).map((s) => {
                  const points = pointsOf.get(s)
                  if (points === undefined) throw new Error(`no series loaded for ${s}`)
                  const now = current[s]
                  return <ChartCard key={s} slug={s} points={points} current={now === undefined ? null : now} />
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
