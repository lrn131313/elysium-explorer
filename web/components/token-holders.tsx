import { Info, Sparkles } from 'lucide-react'
import { age, counted, num } from '@/lib/format'
import { SNAPSHOT_CAP, type HolderSnapshot } from '@/lib/token-api'
import { compactCount, compactUnits, share2 } from '@/lib/token-format'
import { holderStats, type HolderStats } from '@/lib/token-stats'
import type { TokenInfo } from '@/lib/types'
import { Dismissible, ViewSwitch } from './token-client'

// Etherscan's "Holders Overview" block (research/token.md §1.8), no-price variant: this chain has no token prices, so
// every amount is in token units and every share is of the supply. Charts are our own inline SVG, drawn by the server.

const GINI_TIP = 'Measures how evenly tokens are distributed: 0 = perfectly equal, 1 = one holder owns all tokens.'

/** A symbol short enough for chart labels. */
const shortSym = (s: string) => (s.length > 10 ? `${s.slice(0, 9)}…` : s)

function snapshotAge(at: number): string {
  const ms = Date.now() - at
  return ms < 1000 ? 'less than 1 sec ago' : age(at)
}

function StatCard({ label, help, value, children }: { label: string; help?: string; value: string; children: React.ReactNode }) {
  return (
    <div className="col-md-6 col-xl-4">
      <div className="card tk-flat h-100">
        <div className="card-body">
          <div className="ex-cap mb-1">
            {label}
            {help && (
              <span className="tk-help ms-1" title={help}>
                <Info size={12} />
              </span>
            )}
          </div>
          <div className="tk-stat-value">{value}</div>
          <hr className="my-3 tk-hr" />
          <div className="small d-flex align-items-baseline gap-1">
            <Sparkles size={12} className="flex-shrink-0 align-self-center" />
            <span>{children}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- donut ----------

const W = 320
const H = 208
const CX = W / 2
const CY = H * 0.44
const R = (H * 0.54) / 2
const R_IN = R * 0.83

const point = (r: number, a: number) => [CX + r * Math.sin(a), CY - r * Math.cos(a)] as const
const f = (n: number) => n.toFixed(2)

/** One ring slice from angle a0 to a1 (radians, 0 at 12 o'clock, clockwise). */
function slicePath(a0: number, a1: number): string {
  if (a1 - a0 >= 2 * Math.PI - 1e-6) {
    // A whole ring: two circles, the inner one cut out by the even-odd fill rule.
    return `M ${f(CX)} ${f(CY - R)} a ${f(R)} ${f(R)} 0 1 1 0 ${f(2 * R)} a ${f(R)} ${f(R)} 0 1 1 0 ${f(-2 * R)} Z M ${f(CX)} ${f(CY - R_IN)} a ${f(R_IN)} ${f(R_IN)} 0 1 0 0 ${f(2 * R_IN)} a ${f(R_IN)} ${f(R_IN)} 0 1 0 0 ${f(-2 * R_IN)} Z`
  }
  const large = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = point(R, a0)
  const [x1, y1] = point(R, a1)
  const [x2, y2] = point(R_IN, a1)
  const [x3, y3] = point(R_IN, a0)
  return `M ${f(x0)} ${f(y0)} A ${f(R)} ${f(R)} 0 ${large} 1 ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)} A ${f(R_IN)} ${f(R_IN)} 0 ${large} 0 ${f(x3)} ${f(y3)} Z`
}

/** Share of `part` in `whole` as a float in 0..1, for drawing only. */
const frac = (part: bigint, whole: bigint) => (whole > 0n ? Number((part * 1_000_000n) / whole) / 1_000_000 : 0)

function Donut({ s, dec, sym }: { s: HolderStats; dec: number; sym: string }) {
  const held = s.cohorts.reduce((a, c) => a + c.amount, 0n)
  let at = 0
  const slices = s.cohorts.map((c, i) => {
    const share = frac(c.amount, held)
    const a0 = at * 2 * Math.PI
    at += share
    return { c, i, share, a0, a1: at * 2 * Math.PI }
  })
  return (
    <figure className="mb-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="tk-donut" role="img" aria-label="Holder concentration chart">
        {slices
          .filter((x) => x.share > 0)
          .map((x) => (
            <path key={x.c.label} d={slicePath(x.a0, x.a1)} className={`tk-c${x.i + 1}`} fillRule="evenodd">
              <title>{`${x.c.label}: ${share2(x.c.amount, s.supply)}`}</title>
            </path>
          ))}
        {slices
          .filter((x) => x.share >= 0.02)
          .map((x) => {
            const mid = (x.a0 + x.a1) / 2
            const [lx0, ly0] = point(R + 3, mid)
            const [lx1, ly1] = point(R + 16, mid)
            const right = Math.sin(mid) >= 0
            const lx2 = lx1 + (right ? 8 : -8)
            return (
              <g key={x.c.label} className="tk-donut-label">
                <polyline points={`${f(lx0)},${f(ly0)} ${f(lx1)},${f(ly1)} ${f(lx2)},${f(ly1)}`} className={`tk-donut-line tk-s${x.i + 1}`} />
                <text x={f(lx2 + (right ? 3 : -3))} y={f(ly1)} textAnchor={right ? 'start' : 'end'} dominantBaseline="middle">
                  {compactUnits(x.c.amount, dec)}
                </text>
              </g>
            )
          })}
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" className="tk-donut-centre" style={{ fontSize: `${f((2 * R) / 10)}px` }}>
          {compactUnits(s.supply, dec)}
        </text>
      </svg>
      <figcaption className="tk-legend">
        {s.cohorts.map((c, i) => (
          <span key={c.label} className="tk-legend-item" title={`${c.label}: ${compactUnits(c.amount, dec)} ${sym}`}>
            <span className={`tk-dot tk-bg${i + 1}`} />
            <span className="text-muted">{c.label}:</span>
            <span className="fw-medium">{Math.round(frac(c.amount, s.supply) * 100)}%</span>
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

// ---------- horizontal log-scale bars (Tier Distribution, Wallet Depth) ----------

interface Bar {
  label: string
  count: number
  dataLabel: string
  title: string
}

const BW = 320
const LABEL_W = 92
const PLOT_X = LABEL_W + 8
const PLOT_W = BW - PLOT_X - 36
const ROW = 20

/** Bars of log10(count) (a count of 1 draws no length; 0 draws no bar), Etherscan's encoding for these two charts. */
function LogBars({ bars, kind, axisMax, ticks }: { bars: Bar[]; kind: 'tier' | 'depth'; axisMax: number; ticks: { at: number; text: string }[] }) {
  const height = bars.length * ROW + 24
  const x = (v: number) => PLOT_X + (v / axisMax) * PLOT_W
  const axisY = bars.length * ROW + 4
  return (
    <svg viewBox={`0 0 ${BW} ${height}`} className="tk-bars" role="img" aria-label={kind === 'tier' ? 'Tier distribution chart' : 'Wallet depth chart'}>
      {ticks.map((t) => (
        <g key={t.text}>
          <line x1={f(x(t.at))} x2={f(x(t.at))} y1={0} y2={axisY} className="tk-grid" />
          <text x={f(x(t.at))} y={axisY + 12} textAnchor="middle" className="tk-axis">
            {t.text}
          </text>
        </g>
      ))}
      {bars.map((b, i) => {
        const y = i * ROW + ROW / 2
        const len = b.count > 0 ? Math.max(0, (Math.log10(b.count) / axisMax) * PLOT_W) : 0
        return (
          <g key={b.label}>
            <title>{b.title}</title>
            <text x={LABEL_W} y={y} textAnchor="end" dominantBaseline="middle" className="tk-cat">
              {b.label}
            </text>
            {b.count > 0 && <rect x={PLOT_X} y={y - 5} width={f(len)} height={10} rx={3} className={kind === 'tier' ? 'tk-bar-tier' : 'tk-bar-depth'} />}
            <text x={f(PLOT_X + len + 4)} y={y} dominantBaseline="middle" className="tk-datalabel">
              {b.dataLabel}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** "% holders" on a tier bar: 2 decimals, "<0.1%" for a sliver, nothing for an empty tier. */
function holdersLabel(count: number, holders: number): string {
  if (count === 0 || holders === 0) return ''
  const p = (count / holders) * 100
  return p < 0.1 ? '<0.1%' : `${p.toFixed(2)}%`
}

function tierTip(rule: { above: number | null; upTo: number | null }, sym: string): string {
  if (rule.upTo === null && rule.above !== null) return `Wallets holding more than ${num(rule.above)} ${sym}`
  if (rule.above === null && rule.upTo !== null) return `Wallets holding up to ${num(rule.upTo)} ${sym}`
  return `Wallets holding more than ${num(rule.above ?? 0)} ${sym} and up to ${num(rule.upTo ?? 0)} ${sym}`
}

function Tiers({ s, sym }: { s: HolderStats; sym: string }) {
  const holders = BigInt(s.holders)
  return (
    <table className="table table-sm small table-hover mb-0 tk-mini-table">
      <thead>
        <tr>
          <th>Tier</th>
          <th className="text-end">Holder Count</th>
          <th className="text-end">% Holders</th>
          <th className="text-end">% Supply</th>
        </tr>
      </thead>
      <tbody>
        {s.tiers.map((t) => (
          <tr key={t.name}>
            <td>
              <span className="d-inline-flex align-items-center gap-1" title={tierTip(t.rule, sym)}>
                <span className="tk-dot tk-bg-tier" />
                {t.name}
              </span>
            </td>
            <td className="text-end">{num(t.count)}</td>
            <td className="text-end">{share2(BigInt(t.count), holders)}</td>
            <td className="text-end">{share2(t.amount, s.supply)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Cohorts({ s, dec, sym }: { s: HolderStats; dec: number; sym: string }) {
  return (
    <table className="table table-sm small table-hover mb-0 tk-mini-table">
      <thead>
        <tr>
          <th>Cohort</th>
          <th className="text-end">Holding Amount</th>
          <th className="text-end">% Supply</th>
        </tr>
      </thead>
      <tbody>
        {s.cohorts.map((c, i) => (
          <tr key={c.label}>
            <td>
              <span className="d-inline-flex align-items-center gap-1">
                <span className={`tk-dot tk-bg${i + 1}`} />
                {c.label}
              </span>
            </td>
            <td className="text-end">
              {compactUnits(c.amount, dec)} {sym}
            </td>
            <td className="text-end">{share2(c.amount, s.supply)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DepthList({ s, sym }: { s: HolderStats; sym: string }) {
  const holders = BigInt(s.holders)
  return (
    <table className="table table-sm small table-hover mb-0 tk-mini-table">
      <thead>
        <tr>
          <th>Threshold</th>
          <th className="text-end">Holders</th>
          <th className="text-end">% of Total</th>
        </tr>
      </thead>
      <tbody>
        {s.depth.map((d) => (
          <tr key={d.label}>
            <td>
              &gt; {d.label} {sym}
            </td>
            <td className="text-end">{num(d.count)}</td>
            <td className="text-end">{share2(BigInt(d.count), holders)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Ticks 1, 10, … 10^top for a log axis. */
const logTicks = (top: number) => Array.from({ length: top + 1 }, (_, i) => ({ at: i, text: compactCount(10 ** i) }))

/**
 * The analytics above the holder list: snapshot line, no-price notice, three stat cards and three chart cards, from a
 * full pull of the token's holders. `snap` is null when the token has more than SNAPSHOT_CAP holders (not pulled).
 */
export function HoldersOverview({ t, snap }: { t: TokenInfo; snap: HolderSnapshot | null }) {
  const dec = Number(t.decimals ?? '0')
  const sym = t.symbol ?? ''
  const head = (
    <div className="d-flex flex-wrap align-items-baseline gap-2 mb-3">
      <h3 className="h6 mb-0">Holders Overview</h3>
      {snap !== null && <span className="small text-muted">(Analytics Snapshot taken {snapshotAge(snap.at)})</span>}
    </div>
  )
  if (snap === null || !snap.complete || t.total_supply === null) {
    return (
      <div className="card mb-3">
        <div className="card-body">
          {head}
          <p className="text-muted mb-0">
            {snap !== null && snap.complete
              ? 'This token reports no total supply, so its holder shares cannot be computed.'
              : `Holder analytics are computed for tokens with up to ${num(SNAPSHOT_CAP)} holders.`}
          </p>
        </div>
      </div>
    )
  }
  const s = holderStats(
    snap.holders.map((h) => BigInt(h.value)),
    dec,
    BigInt(t.total_supply),
  )
  const tierTop = Math.max(6, Math.ceil(Math.log10(Math.max(1, ...s.tiers.map((x) => x.count)))))
  const depthTop = Math.max(Math.log10(5_000_000), Math.log10(Math.max(1, ...s.depth.map((x) => x.count))))
  const symShort = shortSym(sym)
  return (
    <div className="card mb-3">
      <div className="card-body">
        {head}
        <Dismissible>
          <Info size={14} className="me-1 flex-shrink-0" />
          Displays token supply only, without market value (USD): no price source is known for this token.
        </Dismissible>
        <div className="row g-3">
          <StatCard label="Top 100 Concentration" value={share2(s.top100, s.supply)}>
            Supply of Top 5 holders: <strong>{share2(s.top5, s.supply)}</strong> | Top 10 holders: <strong>{share2(s.top10, s.supply)}</strong>
          </StatCard>
          <StatCard label="Whale Concentration" value={share2(s.whales.amount, s.supply)}>
            Whales make up <strong>{share2(BigInt(s.whales.count), BigInt(s.holders))}</strong> of holders
          </StatCard>
          <StatCard label="Gini Distribution Score" help={GINI_TIP} value={s.gini === null ? '-' : s.gini.toFixed(4)}>
            There are <span className="fw-medium">{num(s.atLeastOnePercent)}</span> holder{s.atLeastOnePercent === 1 ? '' : 's'} who own at least 1% of total
            supply
          </StatCard>
        </div>
        <div className="row g-3 mt-0">
          <div className="col-12 col-xl-4">
            <ViewSwitch title="Holder Concentration" initial="chart" chartKind="pie" list={<Cohorts s={s} dec={dec} sym={sym} />} chart={<Donut s={s} dec={dec} sym={sym} />} />
          </div>
          <div className="col-12 col-xl-4">
            <ViewSwitch
              title="Tier Distribution"
              initial="list"
              chartKind="bar"
              list={<Tiers s={s} sym={sym} />}
              chart={
                <LogBars
                  kind="tier"
                  axisMax={tierTop + 0.35}
                  ticks={logTicks(tierTop)}
                  bars={s.tiers.map((x) => ({
                    label: x.name,
                    count: x.count,
                    dataLabel: holdersLabel(x.count, s.holders),
                    title: `${x.name}: ${counted(x.count, 'holder')}, ${share2(x.amount, s.supply)} of supply`,
                  }))}
                />
              }
            />
          </div>
          <div className="col-12 col-xl-4">
            <ViewSwitch
              title="Wallet Depth by Threshold"
              initial="chart"
              chartKind="bar"
              list={<DepthList s={s} sym={sym} />}
              chart={
                <LogBars
                  kind="depth"
                  axisMax={depthTop}
                  ticks={[...logTicks(6), { at: Math.log10(5_000_000), text: compactCount(5_000_000) }]}
                  bars={s.depth.map((x) => ({
                    label: `> ${x.label} ${symShort}`,
                    count: x.count,
                    dataLabel: x.count === 0 ? '' : compactCount(x.count),
                    title: `> ${x.label} ${sym}: ${counted(x.count, 'holder')}, ${share2(BigInt(x.count), BigInt(s.holders))} of total`,
                  }))}
                />
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
