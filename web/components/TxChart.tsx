import type { ChartPoint } from '@/lib/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const label = (d: string) => {
  const [, m, day] = d.split('-').map(Number)
  return `${MONTHS[(m ?? 1) - 1]} ${day}`
}
const compact = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n))

/** Drawing height of the line; the 105px chart box (Etherscan's #container-1) also holds the date row. */
const H = 76
const W = 360

/** 14-day transaction history line (server-rendered SVG, no chart library). Its colour comes from the theme. */
export function TxChart({ points }: { points: ChartPoint[] }) {
  const data = [...points].sort((a, b) => a.date.localeCompare(b.date)).slice(-14)
  if (data.length < 2) return <div className="ex-txchart text-muted fs-sm">Not enough history yet.</div>
  const vals = data.map((p) => p.transactions_count)
  const max = Math.max(...vals)
  const min = Math.min(...vals)
  const span = max - min || 1
  const xy = data.map((p, i) => [(i / (data.length - 1)) * W, H - 4 - ((p.transactions_count - min) / span) * (H - 8)] as const)
  const path = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const first = data[0]
  const middle = data[Math.floor(data.length / 2)]
  const last = data[data.length - 1]
  return (
    <div className="ex-txchart d-flex gap-2">
      <div className="d-flex flex-column justify-content-between text-muted fs-xs" style={{ height: H }}>
        <span>{compact(max)}</span>
        <span>{compact(min)}</span>
      </div>
      <div className="flex-grow-1">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="Transactions per day, last 14 days">
          <title>{data.map((p) => `${label(p.date)}: ${p.transactions_count.toLocaleString('en-US')}`).join('\n')}</title>
          <path d={path} fill="none" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="d-flex justify-content-between text-muted fs-xs mt-1">
          <span>{first && label(first.date)}</span>
          <span>{middle && label(middle.date)}</span>
          <span>{last && label(last.date)}</span>
        </div>
      </div>
    </div>
  )
}
