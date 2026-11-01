// The charts Charts & Stats can draw from data this instance really has (checked 2026-11-01). Blockscout's stats
// service is not running, so its many daily charts (addresses, gas, block size, contracts...) have no source and are
// left out. What remains: the daily transactions count and the daily fee totals (Blockscout's own daily table, read
// through the transactions chart and legacy `stats.totalfees`), and HYPE's daily price and market cap (CoinGecko).
import { cache } from 'react'
import type { ChartPoint } from '@/components/chain-chart'
import { smallUsd } from '@/components/chain-format'
import { api } from '@/lib/api'
import { dailyFees, marketChart } from '@/lib/chain-api'
import { formatUnits, num, usd } from '@/lib/format'
import { SITE } from '@/lib/site'

/** A chart point with its value as the data table writes it, and as the CSV file does (exact where the source is). */
export type SeriesPoint = ChartPoint & { text: string; csv: string }

/** A point whose tooltip reads "<name>: <text>". */
const point = (date: string, value: number, name: string, text: string, csv: string): SeriesPoint => ({ date, value, tip: `${name}: ${text}`, text, csv })

export interface ChartDef {
  /** Etherscan's card title on the index ("Daily Transactions Chart (30D)" without the range). */
  card: string
  /** The chart page's heading. */
  title: string
  /** The card's info tooltip and the chart page's lead text. */
  about: string
  /** The CSV value column's header. */
  unit: string
  /** Where the numbers come from and what the newest point means (the chart page's footnote). */
  source: string
  /** Index section it sits in. */
  section: 'market' | 'blockchain' | 'network'
  /** Whether the y axis starts at zero (counts and totals) or hugs the data (prices). */
  zero: boolean
  axis: (v: number) => string
  load: () => Promise<SeriesPoint[]>
}

const COMPACT: [number, string][] = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
]

/** Axis labels: "400K", "1.5M", "0.25". */
function compact(v: number): string {
  for (const [size, suffix] of COMPACT) if (Math.abs(v) >= size) return `${Number((v / size).toPrecision(3))}${suffix}`
  return String(Number(v.toPrecision(3)))
}

const WEI = 1e18

/**
 * Days of the transactions chart, oldest first, from the chain's first day with transactions. Blockscout's chart
 * covers the last 30 finished days and writes 0 for days before the chain existed; those are not shown as zeros.
 */
const txChart = cache(() => api.txChart())
const marketData = cache(marketChart)

async function txDays(): Promise<{ date: string; count: number }[]> {
  const chart = await txChart()
  const days = chart.chart_data.map((p) => ({ date: p.date, count: p.transactions_count })).sort((a, b) => a.date.localeCompare(b.date))
  const start = days.findIndex((d) => d.count > 0)
  return start === -1 ? [] : days.slice(start)
}

/** Daily fee totals for the chart's days, in wei. A day of the chart without a fee record has no point. */
async function feeDays(): Promise<{ date: string; count: number; fees: bigint }[]> {
  const days = await txDays()
  const fees = await dailyFees(days.map((d) => d.date))
  return days.flatMap((d) => {
    const f = fees.get(d.date)
    if (f === undefined) throw new Error(`dailyFees returned nothing for ${d.date}`)
    return f === null ? [] : [{ ...d, fees: f }]
  })
}

async function market(): Promise<{ date: string; price: number | null; cap: number | null }[]> {
  const m = await marketData()
  return m.chart_data
    .map((p) => ({
      date: p.date,
      price: p.closing_price === null ? null : Number(p.closing_price),
      cap: p.market_cap === null ? null : Number(p.market_cap),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export const CHARTS = {
  tx: {
    card: 'Daily Transactions Chart',
    title: `${SITE.chainName} Daily Transactions Chart`,
    about: `The number of transactions on ${SITE.chainName} each day (UTC).`,
    unit: 'Value',
    source: `Blockscout's daily totals for ${SITE.chainName}. A day appears once it has ended; the days before the chain's first transactions are left out.`,
    section: 'blockchain',
    zero: true,
    axis: compact,
    load: async () => {
      const days = await txDays()
      return days.map((d) => point(d.date, d.count, 'Transactions', num(d.count), String(d.count)))
    },
  },
  hypeprice: {
    card: `${SITE.coin} Daily Price (USD) Chart`,
    title: `${SITE.coin} Daily Price (USD) Chart`,
    about: `The daily closing price of ${SITE.coin} in US dollars (CoinGecko).`,
    unit: 'Value',
    source: `CoinGecko, through Blockscout. The newest point is today's price so far.`,
    section: 'market',
    zero: false,
    axis: (v) => `$${compact(v)}`,
    load: async () => {
      const days = (await market()).flatMap((d) => (d.price === null ? [] : [{ date: d.date, price: d.price }]))
      return days.map((d) => point(d.date, d.price, 'Price', usd(d.price), String(d.price)))
    },
  },
  marketcap: {
    card: `${SITE.coin} Market Capitalization Chart`,
    title: `${SITE.coin} Market Capitalization Chart`,
    about: `The daily market capitalization of ${SITE.coin} in US dollars across all chains (CoinGecko).`,
    unit: 'Value',
    source: `CoinGecko, through Blockscout. The newest point is today's price so far.`,
    section: 'market',
    zero: false,
    axis: (v) => `$${compact(v)}`,
    load: async () => {
      const days = (await market()).flatMap((d) => (d.cap === null ? [] : [{ date: d.date, cap: d.cap }]))
      return days.map((d) => point(d.date, d.cap, 'Market Cap', usd(d.cap), d.cap.toFixed(2)))
    },
  },
  transactionfee: {
    card: 'Network Transaction Fee Chart',
    title: `${SITE.chainName} Network Transaction Fee Chart`,
    about: `The total ${SITE.coin} paid in transaction fees on ${SITE.chainName} each day (UTC).`,
    unit: `Value (${SITE.coin})`,
    source: `Blockscout's daily totals for ${SITE.chainName}. A day appears once it has ended; the days before the chain's first transactions are left out.`,
    section: 'network',
    zero: true,
    axis: compact,
    load: async () => {
      const days = await feeDays()
      return days.map((d) =>
        point(d.date, Number(d.fees) / WEI, 'Fees', `${formatUnits(d.fees, 18, { maxFraction: 6 })} ${SITE.coin}`, formatUnits(d.fees, 18, { grouped: false })),
      )
    },
  },
  'avg-txfee-usd': {
    card: 'Average Transaction Fee Chart',
    title: `${SITE.chainName} Average Transaction Fee Chart`,
    about: `The average fee paid per transaction on ${SITE.chainName} each day, in US dollars at that day's ${SITE.coin} closing price.`,
    unit: 'Value (USD)',
    source: `Blockscout's daily fee and transaction totals for ${SITE.chainName}, priced at each day's ${SITE.coin} closing price from CoinGecko. A day appears once it has ended.`,
    section: 'blockchain',
    zero: true,
    axis: (v) => `$${compact(v)}`,
    load: async () => {
      const [days, prices] = await Promise.all([feeDays(), market()])
      const priceOn = new Map(prices.flatMap((p) => (p.price === null ? [] : [[p.date, p.price] as const])))
      const rows = days.flatMap((d) => {
        const price = priceOn.get(d.date)
        if (price === undefined || d.count === 0) return []
        return [{ date: d.date, usd: (Number(d.fees) / WEI / d.count) * price, coin: d.fees / BigInt(d.count) }]
      })
      return rows.map((r) =>
        point(r.date, r.usd, 'Avg. Fee', `${smallUsd(r.usd)} (${formatUnits(r.coin, 18, { maxFraction: 9 })} ${SITE.coin})`, String(r.usd)),
      )
    },
  },
} satisfies Record<string, ChartDef>

export type ChartSlug = keyof typeof CHARTS

export const isChartSlug = (s: string): s is ChartSlug => Object.hasOwn(CHARTS, s)
