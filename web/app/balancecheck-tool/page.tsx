import Link from 'next/link'
import { ToolsLayout, ToolCard } from '@/components/tools-layout'
import { api, NotFoundError } from '@/lib/api'
import { isDay } from '@/lib/export'
import { COIN, formatUnits, isAddress, isBlockNumber, num, utc } from '@/lib/format'
import { one, type SP } from '@/lib/page'
import { blockAtOrBefore, blockHead, coinBalanceAt, tokenBalanceAt, type BlockHead } from '@/lib/tools-api'

export const metadata = { title: 'Account Balance Checker' }

type Kind = 'coin' | 'token'
type By = 'date' | 'block'

interface Query {
  kind: Kind
  a: string
  token: string
  by: By
  date: string
  block: string
}

interface Snapshot {
  account: string
  block: BlockHead
  /** The day asked for (date mode), and whether it is today (then the block is simply the latest). */
  day: { date: string; today: boolean } | null
  raw: bigint
  decimals: number
  symbol: string
  token: { address: string; name: string } | null
}

const dayOf = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10)

/** The day of block 1 (the genesis block has time 0 on this chain); a date before it has no state but the genesis. */
let firstDay: string | null = null
async function chainFirstDay(): Promise<string> {
  if (firstDay === null) {
    const b = await blockHead(1)
    if (b === null) throw new Error('the node has no block 1')
    firstDay = dayOf(b.timestamp)
  }
  return firstDay
}

/** The balance asked for, or what is wrong with the request in words the form can show. */
async function lookup(q: Query, today: string, first: string, latest: BlockHead): Promise<Snapshot | { error: string }> {
  if (!isAddress(q.a)) return { error: 'Enter a valid account address: 0x followed by 40 hexadecimal characters.' }
  if (q.kind === 'token' && !isAddress(q.token)) return { error: 'Enter the token’s contract address: 0x followed by 40 hexadecimal characters.' }

  let head: BlockHead
  let day: Snapshot['day'] = null
  if (q.by === 'date') {
    if (!isDay(q.date)) return { error: 'Choose the date for the snapshot.' }
    if (q.date > today) return { error: 'The date is in the future. Choose today or an earlier day.' }
    if (q.date < first) return { error: `Elysium’s first block was made on ${first}. Choose that day or a later one.` }
    const n = q.date === today ? latest.number : await blockAtOrBefore(Date.parse(`${q.date}T23:59:59Z`) / 1000)
    const b = n === latest.number ? latest : await blockHead(n)
    if (b === null) throw new Error(`the node has no block ${n}, which Blockscout gave for ${q.date}`)
    head = b
    day = { date: q.date, today: q.date === today }
  } else {
    if (!isBlockNumber(q.block) || q.block.length > 15) return { error: 'Enter a block number: digits only.' }
    const n = Number(q.block)
    if (n > latest.number) return { error: `Block ${num(n)} does not exist yet; the latest block is ${num(latest.number)}.` }
    const b = await blockHead(n)
    if (b === null) throw new Error(`the node has no block ${n} below its latest ${latest.number}`)
    head = b
  }

  if (q.kind === 'coin') {
    return { account: q.a, block: head, day, raw: await coinBalanceAt(q.a, head.number), decimals: 18, symbol: COIN, token: null }
  }
  const t = await api.token(q.token).catch((e: unknown) => {
    // Blockscout answers 404 for an address that is no token at all.
    if (e instanceof NotFoundError) return null
    throw e
  })
  if (t === null || t.type !== 'ERC-20') return { error: `${q.token} is not an ERC-20 token contract known to this explorer.` }
  const r = await tokenBalanceAt(q.token, q.a, head.number)
  if ('problem' in r) return { error: r.problem }
  return {
    account: q.a,
    block: head,
    day,
    raw: r.raw,
    // An ERC-20 contract need not implement decimals(); wallets and Etherscan then count its raw units.
    decimals: t.decimals === null ? 0 : Number(t.decimals),
    symbol: t.symbol === null ? '' : t.symbol,
    token: { address: q.token, name: t.name === null ? q.token : t.name },
  }
}

/** Etherscan's Account Balance Checker: an account's HYPE or ERC-20 balance at a past block, or at the end of a day. */
export default async function BalanceCheck({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  // A field left out of the query (first visit, or a hand-made link) reads as empty.
  const field = (k: string) => {
    const v = one(sp, k)
    return v === undefined ? '' : v.trim()
  }
  const q: Query = {
    kind: field('kind') === 'token' ? 'token' : 'coin',
    a: field('a'),
    token: field('token'),
    by: field('by') === 'block' ? 'block' : 'date',
    date: field('date'),
    block: field('block'),
  }
  const today = new Date().toISOString().slice(0, 10)
  const [first, latest] = await Promise.all([chainFirstDay(), blockHead('latest')])
  if (latest === null) throw new Error('the node has no latest block')
  const result = one(sp, 'a') === undefined ? null : await lookup(q, today, first, latest)
  const dateValue = isDay(q.date) && q.date >= first && q.date <= today ? q.date : today

  return (
    <ToolsLayout
      active="balancecheck-tool"
      title={`Account Balance Checker (${COIN})`}
      intro={`You can look up the historical balance of an account’s ${COIN} or Tokens at a specific block number or date.`}
    >
      {/* Keyed by the query: the fields take their defaults only when mounted, so Reset (a link here) must remount them. */}
      <form key={JSON.stringify(sp)} action="/balancecheck-tool" method="get" className="tl-balance">
        <ToolCard
          footer={
            <>
              <button type="submit" className="btn btn-primary tl-btn">
                Lookup
              </button>
              <Link href="/balancecheck-tool" className="btn tl-ghost tl-btn">
                Reset
              </Link>
            </>
          }
        >
          <div className="row tl-field">
            <div className="col-xl-6">
              <label htmlFor="bal-kind" className="form-label">
                Choose an option
              </label>
              <select id="bal-kind" name="kind" className="form-select" defaultValue={q.kind}>
                <option value="coin">{COIN}</option>
                <option value="token">Token (ERC-20)</option>
              </select>
            </div>
          </div>
          <div className="row tl-field">
            <div className="col-xl-6">
              <label htmlFor="bal-a" className="form-label">
                Account Address <span className="text-danger">*</span>
              </label>
              <input
                id="bal-a"
                name="a"
                className="form-control"
                placeholder="0x..."
                required
                pattern="\s*0x[0-9a-fA-F]{40}\s*"
                title="0x followed by 40 hexadecimal characters"
                defaultValue={q.a}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
          {/* Shown for Token (ERC-20) only (tools.css); not `required`, because a hidden required field blocks the form. */}
          <div className="row tl-field tl-token-field">
            <div className="col-xl-6">
              <label htmlFor="bal-token" className="form-label">
                Token Contract Address <span className="text-danger">*</span>
              </label>
              <input id="bal-token" name="token" className="form-control" placeholder="0x..." defaultValue={q.token} autoComplete="off" spellCheck={false} />
            </div>
          </div>
          <fieldset className="tl-field">
            <legend className="form-label tl-legend">Filter by:</legend>
            <div className="d-flex gap-3">
              <div className="form-check">
                <input id="bal-by-date" className="form-check-input" type="radio" name="by" value="date" defaultChecked={q.by === 'date'} />
                <label className="form-check-label" htmlFor="bal-by-date">
                  Date
                </label>
              </div>
              <div className="form-check">
                <input id="bal-by-block" className="form-check-input" type="radio" name="by" value="block" defaultChecked={q.by === 'block'} />
                <label className="form-check-label" htmlFor="bal-by-block">
                  Block Number
                </label>
              </div>
            </div>
          </fieldset>
          <div className="row tl-field tl-by-date">
            <div className="col-xl-6">
              <label htmlFor="bal-date" className="form-label">
                Date for the snapshot
              </label>
              <input id="bal-date" name="date" type="date" className="form-control" min={first} max={today} defaultValue={dateValue} />
              <p className="tl-tip">The balance at the end of that day, 23:59:59 UTC (for today, at the latest block).</p>
            </div>
          </div>
          <div className="row tl-field tl-by-block">
            <div className="col-xl-6">
              <label htmlFor="bal-block" className="form-label">
                Block Number
              </label>
              <input
                id="bal-block"
                name="block"
                className="form-control"
                inputMode="numeric"
                placeholder={`0 to ${latest.number}`}
                defaultValue={q.block}
                autoComplete="off"
              />
            </div>
          </div>
        </ToolCard>
      </form>
      {result !== null &&
        ('error' in result ? (
          <div className="alert alert-danger py-2 mt-3 text-break" role="alert">
            {result.error}
          </div>
        ) : (
          <SnapshotCard s={result} />
        ))}
    </ToolsLayout>
  )
}

function SnapshotCard({ s }: { s: Snapshot }) {
  return (
    <div className="card tl-card mt-3">
      <div className="card-body">
        <h3 className="tl-result-title">Balance Snapshot</h3>
        <dl className="row tl-dl">
          <dt className="col-sm-3">Account:</dt>
          <dd className="col-sm-9">
            <Link href={`/address/${s.account}`} className="font-monospace text-break">
              {s.account}
            </Link>
          </dd>
          {s.token !== null && (
            <>
              <dt className="col-sm-3">Token:</dt>
              <dd className="col-sm-9">
                <Link href={`/token/${s.token.address}`}>
                  {s.token.name}
                  {s.symbol !== '' && ` (${s.symbol})`}
                </Link>
              </dd>
            </>
          )}
          <dt className="col-sm-3">Block:</dt>
          <dd className="col-sm-9">
            <Link href={`/block/${s.block.number}`}>{s.block.number}</Link>
            {/* Elysium's genesis block carries time 0; it has no meaningful date. */}
            {s.block.number > 0 && <span className="text-muted"> ({utc(s.block.timestamp * 1000)})</span>}
            {s.day !== null && (
              <div className="tl-tip">
                {s.day.today ? 'The latest block so far today.' : `The last block on or before ${s.day.date} 23:59:59 UTC.`}
              </div>
            )}
          </dd>
          <dt className="col-sm-3">Balance:</dt>
          <dd className="col-sm-9">
            <span className="fw-medium">
              {formatUnits(s.raw, s.decimals)}
              {s.symbol !== '' && ` ${s.symbol}`}
            </span>
            {s.decimals > 0 && (
              <div className="tl-tip">
                {s.raw.toString()} {s.token === null ? 'wei' : 'in the token’s smallest unit'}
              </div>
            )}
          </dd>
        </dl>
      </div>
    </div>
  )
}
