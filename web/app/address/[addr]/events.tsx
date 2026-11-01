import { Search } from 'lucide-react'
import Link from 'next/link'
import { LogData } from '@/components/address-log-data'
import { CopyButton, TimeAgo } from '@/components/client'
import { ListFoot, ListHead } from '@/components/list'
import { Empty, EmptyRow, Method } from '@/components/ui'
import { addressLogs, txInputs, type AddressLog } from '@/lib/address-api'
import { listDate, mid, num } from '@/lib/format'
import { methodNames } from '@/lib/methods'
import { one, type SP } from '@/lib/page'
import { pageSizeFrom, stackFrom, walkNav, walkParams, type Nav } from '@/lib/paging'
import type { AddressInfo, PageParams } from '@/lib/types'

const DEFAULT_SIZE = 25 // "Latest 25 Contract Events"
const COLS = 5
/** A topic is one 32-byte word. Blockscout answers anything else with 422. */
const TOPIC = /^0x[0-9a-f]{64}$/
const TIP = 'Tip: Logs are used by developers/external UI providers for keeping track of contract actions and for auditing'
/** Blockscout decodes an unverified contract's events by their topic0 alone: the types are certain, the names are not. */
const GUESS_TIP =
  "This contract's source is not verified here. The event was decoded by matching its topic0 to a known event signature: the types are exact, the parameter names come from that known event and may differ from this contract's source."

type Param = NonNullable<AddressLog['decoded']>['parameters'][number]

const valueText = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v))

/** A decoded value; an address links to its page. */
function Value({ p }: { p: Param }) {
  if (p.type === 'address' && typeof p.value === 'string') return <Link href={`/address/${p.value}`}>{p.value}</Link>
  return <>{valueText(p.value)}</>
}

/** The log's data as 32-byte words, one per line. */
function Words({ data }: { data: string }) {
  const hex = data.slice(2)
  const words: string[] = []
  for (let i = 0; i < hex.length; i += 64) words.push(hex.slice(i, i + 64))
  return (
    <>
      {words.map((w, i) => (
        <div key={i}>{w}</div>
      ))}
    </>
  )
}

/**
 * Etherscan's signature line: "Transfer (index_topic_1 address from, index_topic_2 address to, uint256 value)", the
 * event name a link (here: to this tab filtered by the event's topic0), types green, parameter names red.
 */
function Signature({ d, topic0, base, verified }: { d: NonNullable<AddressLog['decoded']>; topic0: string | null; base: string; verified: boolean }) {
  const paren = d.method_call.indexOf('(')
  const name = paren === -1 ? d.method_call : d.method_call.slice(0, paren)
  let topic = 0
  return (
    <div className="address-log-sig">
      {!verified && (
        <span className="address-log-guess" title={GUESS_TIP}>
          By signature
        </span>
      )}
      {topic0 === null ? (
        <span className="fw-medium">{name}</span>
      ) : (
        <Link href={`${base}?tab=events&topic=${topic0}`} className="fw-medium" title="Show only this event">
          {name}
        </Link>
      )}{' '}
      (
      {d.parameters.map((p, i) => (
        <span key={i}>
          {i > 0 && ', '}
          {p.indexed && `index_topic_${++topic} `}
          <span className="address-log-type">{p.type}</span> <span className="address-log-name">{p.name}</span>
        </span>
      ))}
      )
    </div>
  )
}

/** The Logs cell: signature (when Blockscout could decode the event), the topics, then the data. */
function LogCell({ l, base, verified }: { l: AddressLog; base: string; verified: boolean }) {
  const d = l.decoded
  const indexed = d === null ? [] : d.parameters.filter((p) => p.indexed)
  const plain = d === null ? [] : d.parameters.filter((p) => !p.indexed)
  const topic0 = l.topics[0]
  return (
    <div className="address-log">
      {d !== null && <Signature d={d} topic0={topic0 === undefined ? null : topic0} base={base} verified={verified} />}
      <ul className="address-log-topics">
        {l.topics.map((t, i) => {
          if (t === null) return null
          // topic1..3 carry the indexed parameters in order; topic0 is the event's signature hash.
          const p = i === 0 ? undefined : indexed[i - 1]
          return (
            <li key={i}>
              <span className="text-muted">[topic{i}]</span> <span className="font-mono">{t}</span>
              {p !== undefined && (
                <span className="address-log-decoded">
                  {' '}
                  &rarr; <Value p={p} />
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {l.data !== '0x' &&
        (plain.length > 0 ? (
          <LogData
            dec={plain.map((p, i) => (
              <div key={i}>
                {p.name} ({p.type}) : <Value p={p} />
              </div>
            ))}
            hex={<Words data={l.data} />}
          />
        ) : (
          <div className="address-log-box">
            <Words data={l.data} />
          </div>
        ))}
    </div>
  )
}

/** The Method column: the 4-byte selector of the transaction that emitted the log, its name below when known. */
function MethodCell({ input, names }: { input: string; names: ReadonlyMap<string, string> }) {
  if (input === '0x') return <Method name={null} />
  const selector = input.slice(0, 10)
  const name = names.get(selector)
  return (
    <>
      <span className="ex-method" title={selector}>
        {selector}
      </span>
      {name !== undefined && <div className="small text-muted mt-1">{name}</div>}
    </>
  )
}

/** Blockscout's topic filter matches the word in any position, topic0 to topic3. A plain GET form. */
function TopicForm({ base, topic }: { base: string; topic: string }) {
  return (
    <form action={base} method="get" className="address-search d-flex gap-2" role="search">
      <input type="hidden" name="tab" value="events" />
      <Search size={14} className="address-search-icon" aria-hidden="true" />
      <input
        type="search"
        name="topic"
        defaultValue={topic}
        className="form-control form-control-sm"
        placeholder="Filter By Topic"
        aria-label="Filter By Topic"
        title="A 32-byte topic (0x and 64 hex characters), matched as topic0 to topic3"
      />
      <button type="submit" className="btn btn-sm btn-white">
        Find
      </button>
    </form>
  )
}

function Head({ base, topic, children }: { base: string; topic: string; children: React.ReactNode }) {
  return (
    <ListHead right={<TopicForm base={base} topic={topic} />}>
      {children}
      {topic !== '' && (
        <>
          {' '}
          with topic{' '}
          <span className="font-mono" title={topic}>
            {mid(topic, 10, 8)}
          </span>{' '}
          (<Link href={`${base}?tab=events`}>Clear</Link>)
        </>
      )}
      <span className="ex-list-sub">{TIP}</span>
    </ListHead>
  )
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="card-body p-0">
      <div className="ex-table-wrap">
        <table className="ex-table address-events">
          <thead>
            <tr>
              <th>Transaction Hash</th>
              <th>Block</th>
              <th>Age</th>
              <th>Method</th>
              <th>Logs</th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

/** The rows of one page, and the pager under them. */
async function Rows({ items, base, nav, verified }: { items: AddressLog[]; base: string; nav: Nav; verified: boolean }) {
  const inputOf = await txInputs(items.map((l) => l.transaction_hash))
  const selectors = items.map((l) => inputOf(l.transaction_hash)).filter((i) => i.length >= 10).map((i) => i.slice(0, 10))
  const names = await methodNames(selectors)
  return (
    <>
      <Table>
        {items.length === 0 && <EmptyRow cols={COLS} />}
        {items.map((l) => (
          <tr key={`${l.transaction_hash}-${l.index}`}>
            <td>
              <span className="d-inline-flex align-items-center gap-1">
                <Link href={`/tx/${l.transaction_hash}`} className="ex-hash">
                  {l.transaction_hash}
                </Link>
                <CopyButton text={l.transaction_hash} label="Copy Transaction Hash" />
              </span>
              <div className="small text-muted" title="Log index in the block">
                #{l.index}
              </div>
            </td>
            <td>
              <Link href={`/block/${l.block_number}`}>{l.block_number}</Link>
            </td>
            <td>
              {l.block_timestamp === null ? (
                '-'
              ) : (
                <span title={listDate(l.block_timestamp)}>
                  <TimeAgo ts={l.block_timestamp} />
                </span>
              )}
            </td>
            <td>
              <MethodCell input={inputOf(l.transaction_hash)} names={names} />
            </td>
            <td className="address-log-cell">
              <LogCell l={l} base={base} verified={verified} />
            </td>
          </tr>
        ))}
      </Table>
      {items.length > 0 && <ListFoot nav={nav} />}
    </>
  )
}

/**
 * The Events tab: the logs this contract emitted, newest first, walked page by page (Blockscout has no total for
 * them), optionally filtered by one topic. The Method column is the selector of each log's transaction, read from our
 * node in one batch.
 */
export async function EventsTab({ a, sp }: { a: AddressInfo; sp: SP }) {
  const base = `/address/${a.hash}`
  const size = pageSizeFrom(sp, DEFAULT_SIZE)
  const stack = stackFrom(sp)
  const rawTopic = one(sp, 'topic')
  const topic = rawTopic === undefined ? '' : rawTopic.trim().toLowerCase()

  if (topic !== '' && !TOPIC.test(topic)) {
    return (
      <div className="card mb-3">
        <ListHead right={<TopicForm base={base} topic={rawTopic === undefined ? '' : rawTopic} />}>
          Contract Events
          <span className="ex-list-sub">{TIP}</span>
        </ListHead>
        <Empty title="This is not a topic">A topic is 32 bytes: 0x followed by 64 hex characters.</Empty>
      </div>
    )
  }

  const params: PageParams = walkParams(stack, size)
  const keep: Record<string, string> = { tab: 'events' }
  if (topic !== '') {
    params.topic = topic
    keep.topic = topic
  }
  const page = await addressLogs(a.hash, params)
  const nav = walkNav({ base, keep, size, defaultSize: DEFAULT_SIZE, total: null, stack, next: page.next_page_params })
  const rows = page.items.length
  const from = stack.length * size + 1

  return (
    <div className="card mb-3">
      <Head base={base} topic={topic}>
        {rows === 0 ? (
          'Contract Events'
        ) : stack.length === 0 ? (
          <>Latest {num(rows)} Contract Events</>
        ) : (
          <>
            Contract Events {num(from)} to {num(from + rows - 1)}
          </>
        )}
      </Head>
      <Rows items={page.items} base={base} nav={nav} verified={a.is_verified === true} />
    </div>
  )
}
