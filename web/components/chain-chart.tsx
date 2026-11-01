// Daily line charts for Charts & Stats, drawn on the server as SVG (no chart library, no script).
//
// One series per chart, so no legend: the title names it. A 2px line over a faint area, recessive grid and axes. The
// hover layer is CSS only: each day owns a full-height strip; hovering it shows a crosshair, a marker and a tooltip
// with the date and the exact value. Every chart also ships its numbers as a table and a CSV file (chart pages).
//
// The SVG scales with its box, and its text with it, so a chart is drawn twice: a wide one for md screens and up, a
// narrow one below, each with a viewBox close to the size it is shown at.

export interface ChartPoint {
  /** UTC day, "YYYY-MM-DD". */
  date: string
  value: number
  /** The value as the tooltip writes it ("1,234 transactions", "$88.23"). */
  tip: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 19" */
function shortDay(date: string): string {
  const [, m, d] = date.split('-')
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`
}

/** "Sunday, October 19, 2026", as Etherscan's chart tooltips. */
function longDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

/** A round step that cuts `range` into about `count` parts (1, 2, 2.5 or 5 times a power of ten). */
function niceStep(range: number, count: number): number {
  const raw = range / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const unit = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  return unit * mag
}

/** The y axis: round bounds around the data and the ticks between them. From zero unless `zero` is false. */
function yScale(values: number[], zero: boolean): { lo: number; hi: number; ticks: number[] } {
  let lo = zero ? 0 : Math.min(...values)
  let hi = Math.max(...values)
  if (hi === lo) {
    // A flat series: give it a band to sit in.
    hi = lo === 0 ? 1 : hi + Math.abs(hi) * 0.1
    if (!zero) lo = lo - Math.abs(lo) * 0.1
  }
  const step = niceStep(hi - lo, 4)
  lo = Math.floor(lo / step) * step
  hi = Math.ceil(hi / step) * step
  // Each tick from its index, not by adding steps, so float error does not pile up.
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step)
  return { lo, hi, ticks }
}

interface Frame {
  w: number
  h: number
  left: number
  right: number
  top: number
  bottom: number
  /** Most x-axis dates to write. */
  xLabels: number
  font: number
}

const WIDE: Frame = { w: 1000, h: 340, left: 72, right: 16, top: 16, bottom: 32, xLabels: 8, font: 12 }
const NARROW: Frame = { w: 480, h: 300, left: 60, right: 10, top: 12, bottom: 30, xLabels: 4, font: 12 }
const SPARK: Frame = { w: 400, h: 96, left: 4, right: 4, top: 8, bottom: 6, xLabels: 0, font: 12 }

/** Tooltip text width estimate: SVG cannot measure text on the server; 0.6em per character fits these fonts. */
const textWidth = (s: string, font: number) => s.length * font * 0.6

function Plot({ points, axis, zero, f, label }: { points: ChartPoint[]; axis: (v: number) => string; zero: boolean; f: Frame; label: string }) {
  const plotW = f.w - f.left - f.right
  const plotH = f.h - f.top - f.bottom
  const { lo, hi, ticks } = yScale(
    points.map((p) => p.value),
    zero,
  )
  const n = points.length
  const x = (i: number) => f.left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1))
  const y = (v: number) => f.top + plotH - ((v - lo) / (hi - lo)) * plotH
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('')
  const base = y(lo)
  const first = points[0]
  const area = first === undefined ? '' : `${line}L${x(n - 1).toFixed(1)},${base.toFixed(1)}L${x(0).toFixed(1)},${base.toFixed(1)}Z`
  const every = f.xLabels === 0 ? 0 : Math.max(1, Math.ceil(n / f.xLabels))
  const strip = n === 1 ? plotW : plotW / (n - 1)
  const showAxes = f.xLabels > 0
  return (
    <svg viewBox={`0 0 ${f.w} ${f.h}`} className="chain-chart" role="img" aria-label={label} style={{ fontSize: f.font }}>
      {showAxes &&
        ticks.map((t) => (
          <g key={t} className="chain-chart-grid">
            <line x1={f.left} x2={f.w - f.right} y1={y(t)} y2={y(t)} />
            <text x={f.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {axis(t)}
            </text>
          </g>
        ))}
      {showAxes &&
        points.map((p, i) =>
          // Every `every`-th day and the last one; a regular label too close to the last one is dropped.
          (i % every === 0 && n - 1 - i >= every / 2) || i === n - 1 ? (
            <text key={p.date} className="chain-chart-xlabel" x={x(i)} y={f.h - 10} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
              {shortDay(p.date)}
            </text>
          ) : null,
        )}
      <path className="chain-chart-area" d={area} />
      <path className="chain-chart-line" d={line} />
      {points.map((p, i) => {
        const px = x(i)
        const py = y(p.value)
        const head = longDay(p.date)
        const boxW = Math.max(textWidth(head, f.font), textWidth(p.tip, f.font)) + 20
        const boxH = f.font * 2 + 20
        // Right of the point, or left of it near the right edge; kept inside the chart either way.
        const bx = Math.max(2, Math.min(px + boxW + 12 > f.w ? px - boxW - 12 : px + 12, f.w - boxW - 2))
        const by = f === SPARK ? 2 : f.top + 4
        return (
          <g key={p.date} className="chain-chart-hit">
            <rect className="chain-chart-strip" x={px - strip / 2} y={0} width={strip} height={f.h} />
            <line className="chain-chart-cross" x1={px} x2={px} y1={f.top} y2={f.top + plotH} />
            <circle className="chain-chart-dot" cx={px} cy={py} r={4} />
            <g className="chain-chart-tip">
              <rect x={bx} y={by} width={boxW} height={boxH} rx={6} />
              <text x={bx + 10} y={by + 10 + f.font * 0.8} className="chain-chart-tip-day">
                {head}
              </text>
              <text x={bx + 10} y={by + 14 + f.font * 1.8} className="chain-chart-tip-value">
                {p.tip}
              </text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}

/** A full chart (chart pages): axes, grid, dates. */
export function DailyChart({ points, axis, zero = true, label }: { points: ChartPoint[]; axis: (v: number) => string; zero?: boolean; label: string }) {
  return (
    <>
      <div className="d-none d-md-block">
        <Plot points={points} axis={axis} zero={zero} f={WIDE} label={label} />
      </div>
      <div className="d-md-none">
        <Plot points={points} axis={axis} zero={zero} f={NARROW} label={label} />
      </div>
    </>
  )
}

/** A small chart in a Charts & Stats card: the line only, tooltips on hover. */
export function Sparkline({ points, zero = true, label }: { points: ChartPoint[]; zero?: boolean; label: string }) {
  return <Plot points={points} axis={String} zero={zero} f={SPARK} label={label} />
}
