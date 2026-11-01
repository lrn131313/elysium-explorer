import { Clock3 } from 'lucide-react'
import Link from 'next/link'
import { AddressLink } from '@/components/AddressLink'
import { CopyButton, MoreDetails, TimeAgo } from '@/components/client'
import { ListFoot, ListHead, NavPager, WalkCount } from '@/components/list'
import { InternalTable } from '@/components/tables'
import { ActionCard } from '@/components/tx-action'
import { InternalTransfers, TokenTransfers } from '@/components/tx-transfers'
import { Hr, Note, PageHead, Row, StatusBadge, Tabs } from '@/components/ui'
import { api } from '@/lib/api'
import { coin, gwei, isTxHash, mid, num, usdOf, utc } from '@/lib/format'
import { one, orNotFound, type SP } from '@/lib/page'
import { pageSizeFrom, stackFrom, walkNav, walkParams, type Cursor, type PageSize } from '@/lib/paging'
import { SITE } from '@/lib/site'
import { txAction } from '@/lib/tx-action'
import { coinMoves } from '@/lib/tx-data'
import type { Log, Page, Transaction } from '@/lib/types'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }: { params: Promise<{ hash: string }> }) {
  return { title: `Transaction ${mid((await params).hash, 10, 8)}` }
}

const TX_TYPES: Record<number, string> = { 0: 'Legacy', 1: 'EIP-2930', 2: 'EIP-1559', 3: 'EIP-4844', 4: 'EIP-7702', 100: 'Arbitrum deposit', 101: 'Arbitrum unsigned', 102: 'Arbitrum contract', 104: 'Arbitrum retry', 105: 'Arbitrum submit retryable', 106: 'ArbOS internal' }

function valueText(v: unknown): string {
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

async function Overview({ t }: { t: Transaction }) {
  const rate = t.historic_exchange_rate ?? t.exchange_rate
  const valueUsd = usdOf(t.value, rate)
  const feeUsd = t.fee.value ? usdOf(t.fee.value, rate) : null
  const arb = t.arbitrum
  const moves = await coinMoves(t.hash)
  const action = await txAction(t, moves)
  return (
    <>
      {action !== null && <ActionCard action={action} />}
      <div className="card mb-3">
        <div className="card-body ex-dl">
          <Row label="Transaction Hash" help="Unique identifier of this transaction.">
            <span className="font-mono">{t.hash}</span> <CopyButton text={t.hash} />
          </Row>
          <Row label="Status" help="Whether the transaction executed successfully.">
            <StatusBadge status={t.status} />
            {t.status === 'error' && t.result && <span className="text-danger ms-2">{t.result}</span>}
          </Row>
          <Row label="Block" help="Block this transaction was included in.">
            {t.block_number !== null ? (
              <span className="d-inline-flex align-items-center gap-2">
                <Link href={`/block/${t.block_number}`}>{t.block_number}</Link>
                <span className="ex-badge">{num(t.confirmations)} Block Confirmations</span>
              </span>
            ) : (
              'Pending'
            )}
          </Row>
          <Row label="Timestamp" help="When the block containing this transaction was produced.">
            {t.timestamp ? (
              <span className="d-inline-flex align-items-center gap-1">
                <Clock3 size={14} /> <TimeAgo ts={t.timestamp} /> ({utc(t.timestamp)})
              </span>
            ) : (
              '-'
            )}
          </Row>
          {arb && (
            <Row label="Rollup Status" help={`Where this transaction stands on its way to ${SITE.parentChain}.`}>
              <span className="ex-badge">{arb.status ?? '-'}</span>
              {arb.batch_number !== null && (
                <span className="ms-2">
                  Batch <span className="fw-medium">{arb.batch_number}</span>
                </span>
              )}
              {arb.contains_message === 'incoming' && <span className="ms-2 text-muted">(message from {SITE.parentChain})</span>}
              {arb.contains_message === 'outcoming' && <span className="ms-2 text-muted">(message to {SITE.parentChain})</span>}
            </Row>
          )}
          <Hr />
          <Row label="From" help="The sending party of the transaction.">
            <AddressLink a={t.from} full copy />
          </Row>
          <Row label={t.to?.is_contract ? 'Interacted With (To)' : 'To'} help="The receiving party of the transaction (could be a contract).">
            {t.to ? (
              <AddressLink a={t.to} full copy />
            ) : t.created_contract ? (
              <span>
                [Contract <AddressLink a={t.created_contract} full copy /> Created]
              </span>
            ) : (
              '-'
            )}
          </Row>
          <InternalTransfers moves={moves} rate={rate} hash={t.hash} />
          {t.token_transfers && t.token_transfers.length > 0 && <TokenTransfers transfers={t.token_transfers} overflow={t.token_transfers_overflow ?? false} />}
          <Hr />
          <Row label="Value" help={`Amount of ${SITE.coin} sent with this transaction.`}>
            {coin(t.value)} {valueUsd && <span className="ex-badge ms-1">{valueUsd}</span>}
          </Row>
          <Row label="Transaction Fee" help="Amount paid for processing this transaction.">
            {t.fee.value ? coin(t.fee.value) : '-'} {feeUsd && <span className="ex-badge ms-1">{feeUsd}</span>}
          </Row>
          <Row label="Gas Price" help="Price per unit of gas.">
            {t.gas_price ? (
              <>
                {gwei(t.gas_price)} <span className="text-muted">({coin(t.gas_price)})</span>
              </>
            ) : (
              '-'
            )}
          </Row>
          {arb && (arb.poster_fee !== null || arb.gas_used_for_l1 !== null) && (
            <Row label={`${SITE.parentChain} Data Fee`} help={`Part of the fee that pays for posting this transaction's data to ${SITE.parentChain}.`}>
              {arb.poster_fee !== null ? coin(arb.poster_fee) : '-'}
              {arb.gas_used_for_l1 !== null && <span className="text-muted"> ({num(arb.gas_used_for_l1)} gas for {SITE.parentChain} data)</span>}
            </Row>
          )}
        </div>
      </div>

      <MoreDetails>
        <Row label="Gas Limit & Usage by Txn" help="Gas the sender allowed, and gas actually used.">
          {num(t.gas_limit)} <span className="text-muted">|</span> {t.gas_used ? num(t.gas_used) : '-'}
          {t.gas_used && Number(t.gas_limit) > 0 && (
            <span className="text-muted"> ({((Number(t.gas_used) / Number(t.gas_limit)) * 100).toFixed(2)}%)</span>
          )}
        </Row>
        <Row label="Gas Fees" help="Base fee of the block, and the sender's fee caps.">
          <span className="text-muted">Base:</span> {t.base_fee_per_gas ? gwei(t.base_fee_per_gas) : '-'}
          {t.max_fee_per_gas && (
            <>
              {' '}
              <span className="text-muted">| Max:</span> {gwei(t.max_fee_per_gas)}
            </>
          )}
          {t.max_priority_fee_per_gas && (
            <>
              {' '}
              <span className="text-muted">| Max Priority:</span> {gwei(t.max_priority_fee_per_gas)}
            </>
          )}
        </Row>
        {t.transaction_burnt_fee && (
          <Row label="Burnt Fees" help="Base fee times gas used.">
            {coin(t.transaction_burnt_fee)}
          </Row>
        )}
        <Row label="Other Attributes" help="Transaction type, sender nonce, and position in the block.">
          <span className="d-inline-flex flex-wrap gap-2">
            <span className="ex-badge">
              Txn Type: {t.type ?? '-'} {t.type !== null && TX_TYPES[t.type] ? `(${TX_TYPES[t.type]})` : ''}
            </span>
            <span className="ex-badge">Nonce: {t.nonce}</span>
            <span className="ex-badge">Position In Block: {t.position ?? '-'}</span>
          </span>
        </Row>
        <Row label="Input Data" help="Data sent with the transaction (the contract call).">
          {t.decoded_input ? (
            <div className="ex-code">
              {`Function: ${t.decoded_input.method_call}\n\nMethodID: 0x${t.decoded_input.method_id}\n`}
              {t.decoded_input.parameters.map((p, i) => `[${i}]  ${p.name} (${p.type}): ${valueText(p.value)}\n`).join('')}
            </div>
          ) : (
            <div className="ex-code">{t.raw_input || '0x'}</div>
          )}
        </Row>
      </MoreDetails>
    </>
  )
}

function Logs({ logs }: { logs: Log[] }) {
  if (logs.length === 0) return <div className="text-muted py-4 text-center">This transaction emitted no event logs</div>
  return (
    <div className="d-flex flex-column gap-3">
      {logs.map((l) => (
        <div key={l.index} className="ex-dl-group border-bottom pb-3">
          <Row label="Address" help="Contract that emitted the event.">
            <AddressLink a={l.address} full />
          </Row>
          {l.decoded && (
            <Row label="Name" help="Decoded event signature.">
              <span className="font-mono">{l.decoded.method_call}</span>
            </Row>
          )}
          <Row label="Topics" help="Indexed event fields; topic 0 is the event signature hash.">
            <div className="font-mono fs-sm">
              {l.topics
                .filter((x): x is string => x !== null)
                .map((topic, i) => (
                  <div key={i}>
                    <span className="ex-badge me-1">{i}</span>
                    {topic}
                  </div>
                ))}
            </div>
          </Row>
          <Row label="Data" help="Non-indexed event fields.">
            {l.decoded && l.decoded.parameters.some((p) => !p.indexed) ? (
              <div className="ex-code">{l.decoded.parameters.map((p) => `${p.name} (${p.type}${p.indexed ? ', indexed' : ''}): ${valueText(p.value)}`).join('\n')}</div>
            ) : (
              <div className="ex-code">{l.data}</div>
            )}
          </Row>
        </div>
      ))}
    </div>
  )
}

/** Both tabs list 50 rows a page, as Blockscout does; most transactions fit on one. */
const TAB_SIZE: PageSize = 50

interface TabPaging {
  hash: string
  tab: 'internal' | 'logs'
  size: PageSize
  stack: Cursor[]
}

/** A tab's pager over Blockscout's cursor: its total is known once the last page is reached. */
function tabNav<T>({ hash, tab, size, stack }: TabPaging, page: Page<T>) {
  const more = page.next_page_params !== null
  const walked = stack.length * size
  const nav = walkNav({ base: `/tx/${hash}`, keep: { tab }, size, defaultSize: TAB_SIZE, total: more ? null : walked + page.items.length, stack, next: page.next_page_params })
  return { nav, more, walked }
}

async function InternalTab(paging: TabPaging) {
  const page = await api.txInternal(paging.hash, walkParams(paging.stack, paging.size))
  const { nav, more, walked } = tabNav(paging, page)
  return (
    <div className="card mb-3">
      <ListHead right={<NavPager nav={nav} />}>
        <WalkCount walked={walked} rows={page.items.length} more={more} noun="internal transaction" />
        <span className="ex-list-sub">Calls between contracts made by this transaction</span>
      </ListHead>
      <div className="card-body p-0">
        <InternalTable items={page.items} variant="tx" />
      </div>
      <ListFoot nav={nav} />
    </div>
  )
}

async function LogsTab(paging: TabPaging) {
  const page = await api.txLogs(paging.hash, walkParams(paging.stack, paging.size))
  const { nav, more, walked } = tabNav(paging, page)
  return (
    <div className="card mb-3">
      <ListHead right={<NavPager nav={nav} />}>
        Transaction Receipt Event Logs
        <span className="ex-list-sub">
          <WalkCount walked={walked} rows={page.items.length} more={more} noun="log" />
        </span>
      </ListHead>
      <div className="card-body">
        <Logs logs={page.items} />
      </div>
      <ListFoot nav={nav} />
    </div>
  )
}

const TAB_KEYS = ['overview', 'internal', 'logs'] as const
type TabKey = (typeof TAB_KEYS)[number]
const isTab = (v: string): v is TabKey => (TAB_KEYS as readonly string[]).includes(v)

export default async function TxPage({ params, searchParams }: { params: Promise<{ hash: string }>; searchParams: Promise<SP> }) {
  const { hash } = await params
  if (!isTxHash(hash)) notFound()
  const sp = await searchParams
  const tabParam = one(sp, 'tab')
  const tab: TabKey = tabParam === undefined ? 'overview' : isTab(tabParam) ? tabParam : notFound()
  const paging = { size: pageSizeFrom(sp, TAB_SIZE), stack: stackFrom(sp) }
  const t = await orNotFound(api.tx(hash))
  const base = `/tx/${hash}`
  const tabs = [
    { key: 'overview', label: 'Overview', href: base },
    { key: 'internal', label: 'Internal Txns', href: `${base}?tab=internal` },
    { key: 'logs', label: 'Logs', href: `${base}?tab=logs` },
  ]

  return (
    <div className="container-xxl">
      <PageHead title="Transaction Details" />
      <Tabs tabs={tabs} active={tab} />
      {tab === 'overview' && <Overview t={t} />}
      {tab === 'internal' && <InternalTab hash={hash} tab="internal" {...paging} />}
      {tab === 'logs' && <LogsTab hash={hash} tab="logs" {...paging} />}
      <Note>
        A transaction is a cryptographically signed instruction that changes the blockchain state. Block explorers track the details of all
        transactions in the network.
      </Note>
    </div>
  )
}
