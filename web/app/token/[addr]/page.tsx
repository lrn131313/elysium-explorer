import { notFound } from 'next/navigation'
import { AddressLink, displayName } from '@/components/AddressLink'
import { ContractTab } from '@/components/contract'
import { CsvExportLine, ListFoot, ListHead, ListTools, WalkCount } from '@/components/list'
import { TokenTransferTable, tokenTransferSheet } from '@/components/tables'
import { TokenFilter } from '@/components/token-client'
import { HoldersOverview } from '@/components/token-holders'
import { InventoryGrid, metadataName, NftTransferTable, rowsFromTransfers } from '@/components/token-nft'
import { HolderCard, isNft, TokenCards, TokenHead, TokenIdCard, TokenProfile, TxFilterCard } from '@/components/token-overview'
import { Empty, Note, Tabs } from '@/components/ui'
import { api, jump, NotFoundError } from '@/lib/api'
import type { Sheet } from '@/lib/csv'
import { counted, formatUnits, isAddress, isTxHash } from '@/lib/format'
import { getLabels } from '@/lib/labels'
import { one, orNotFound, type SP } from '@/lib/page'
import { jumpNav, pageFrom, pageSizeFrom, stackFrom, walkNav, walkParams, type Cursor, type Nav, type PageSize } from '@/lib/paging'
import { SITE } from '@/lib/site'
import { balanceOf, holderSnapshot, SNAPSHOT_CAP, tokenApi, txTransfersOfToken, type NftInstance } from '@/lib/token-api'
import { fixedUnits, percentText } from '@/lib/token-format'
import type { AddressInfo, TokenInfo, TokenTransfer } from '@/lib/types'

export async function generateMetadata({ params }: { params: Promise<{ addr: string }> }) {
  const { addr } = await params
  if (!isAddress(addr)) notFound()
  const t = await orNotFound(api.token(addr))
  return { title: `${t.name ?? 'Unnamed'}${t.symbol ? ` (${t.symbol})` : ''} Token` }
}

const DEFAULT_SIZE: PageSize = 25
const INVENTORY_SIZE: PageSize = 50
/** Etherscan lists a token's holders down to rank 1,000 and no further. */
const HOLDER_LIST_CAP = 1000

/** What "?a=" narrows the token page to: a holder, one transaction, or (NFTs) one token id. */
type Filter = { kind: 'holder'; hash: string } | { kind: 'tx'; hash: string } | { kind: 'id'; id: string }

function filterFrom(sp: SP, nft: boolean): Filter | null {
  const raw = one(sp, 'a')?.trim()
  if (raw === undefined || raw === '') return null
  if (isAddress(raw)) return { kind: 'holder', hash: raw }
  if (isTxHash(raw)) return { kind: 'tx', hash: raw }
  if (nft && /^\d{1,78}$/.test(raw)) return { kind: 'id', id: raw }
  notFound()
}

const filterParam = (f: Filter) => (f.kind === 'id' ? f.id : f.hash)

/** The Holders tab: any page by number (the legacy API supplies the cursor), down to rank 1,000 as on Etherscan. */
async function Holders({ t, sp, total }: { t: TokenInfo; sp: SP; total: number }) {
  const size = pageSizeFrom(sp, DEFAULT_SIZE)
  const p = pageFrom(sp)
  const listed = Math.min(total, HOLDER_LIST_CAP)
  if (p > 1 && (p - 1) * size >= listed) notFound()
  const cursor = p === 1 ? {} : await jump.tokenHolders(t.address_hash, p, size)
  const page = cursor === null ? { items: [], next_page_params: null } : await api.tokenHolders(t.address_hash, { ...cursor, items_count: size })
  const items = page.items.slice(0, Math.max(0, HOLDER_LIST_CAP - (p - 1) * size))
  const nav = jumpNav({
    base: `/token/${t.address_hash}`,
    keep: { tab: 'holders' },
    size,
    defaultSize: DEFAULT_SIZE,
    total: listed,
    page: p,
    hasNext: page.next_page_params !== null && p * size < HOLDER_LIST_CAP,
  })
  const dec = Number(t.decimals ?? '0')
  const supply = t.total_supply === null ? null : BigInt(t.total_supply)
  const share = (value: string) => (supply === null ? null : percentText(BigInt(value), supply, 4))
  const rank = (i: number) => (p - 1) * size + i + 1
  const labels = await getLabels()
  const quantity = (value: string) => (dec > 0 ? fixedUnits(value, dec, 4) : formatUnits(value, 0))
  const sheet: Sheet = {
    name: `export-tokenholders-${t.address_hash}-page${p}.csv`,
    header: ['Rank', 'Address', 'Address_Nametag', 'Quantity', 'Percentage', 'Value'],
    rows: items.map((h, i) => {
      const name = displayName(h.address, labels)
      const pct = share(h.value)
      // Value is the holding in US dollars; this chain's tokens have no price feed, so it stays empty.
      return [String(rank(i)), h.address.hash, name === null ? '' : name, formatUnits(h.value, dec), pct === null ? '' : `${pct}%`, '']
    }),
  }
  const snap = t.type === 'ERC-20' && total > 0 ? (total <= SNAPSHOT_CAP ? await holderSnapshot(t.address_hash) : null) : undefined
  return (
    <>
      {snap !== undefined && <HoldersOverview t={t} snap={snap} />}
      <div className="card mb-3">
        <ListHead right={<ListTools sheet={sheet} nav={nav} />}>
          {total > HOLDER_LIST_CAP ? (
            <>
              Top {counted(HOLDER_LIST_CAP, 'holder')} (From a total of {counted(total, 'holder')})
            </>
          ) : (
            <>A total of {counted(total, 'token holder')}</>
          )}
        </ListHead>
        <div className="card-body p-0">
          <div className="ex-table-wrap">
            <table className="ex-table tk-holders">
              <thead>
                <tr>
                  <th className="tk-rank">Rank</th>
                  <th>Address</th>
                  <th>Quantity</th>
                  <th>Percentage</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="ex-empty-cell">
                      <Empty />
                    </td>
                  </tr>
                )}
                {items.map((h, i) => {
                  const pct = share(h.value)
                  return (
                    <tr key={h.address.hash}>
                      <td>{rank(i)}</td>
                      <td>
                        <AddressLink a={h.address} copy href={`/token/${t.address_hash}?a=${h.address.hash}`} />
                      </td>
                      <td>
                        <span title={`${formatUnits(h.value, dec)}${t.symbol ? ` ${t.symbol}` : ''}`}>{quantity(h.value)}</span>
                      </td>
                      <td className="tk-pct">
                        {pct === null ? (
                          '-'
                        ) : (
                          <>
                            {pct}%
                            <div className="tk-progress" aria-hidden="true">
                              <div className="tk-progress-bar" style={{ width: `${Math.min(100, Number(pct))}%` }} />
                            </div>
                          </>
                        )}
                      </td>
                      <td>
                        <span title="No price source is known for this token">-</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <ListFoot nav={nav} />
      </div>
      {t.type === 'ERC-20' && <CsvExportLine type="tokenholders" a={t.address_hash} />}
    </>
  )
}

/** A filtered list that fits on one page (one transaction's transfers): no other pages. */
function singlePage(base: string, keep: Record<string, string>, count: number): Nav {
  return walkNav({ base, keep, size: DEFAULT_SIZE, defaultSize: DEFAULT_SIZE, total: count, stack: [], next: null })
}

/**
 * The Transfers tab. "?a=" narrows it: a holder (Etherscan's "Filtered by Token Holder", IN/OUT badges), a
 * transaction hash (this token's transfers in it), or an NFT's token id (that item's history).
 */
async function Transfers({ t, sp, filter, tokenTotal, nft }: { t: TokenInfo; sp: SP; filter: Filter | null; tokenTotal: number; nft: boolean }) {
  const base = `/token/${t.address_hash}`
  const keep: Record<string, string> = filter === null ? {} : { a: filterParam(filter) }
  let items: TokenTransfer[]
  let nav: Nav
  let total: number | null
  let note: string | null = null
  if (filter?.kind === 'tx') {
    // One transaction's transfers fit on one page: a page size or a later page is a bad URL here.
    if (one(sp, 'ps') !== undefined || one(sp, 'c') !== undefined) notFound()
    const found = await txTransfersOfToken(filter.hash, t.address_hash)
    items = found.items
    total = items.length
    nav = singlePage(base, keep, total)
    if (!found.complete) note = 'This transaction moves more tokens than one page reads; the first 2,000 of its transfers were searched.'
  } else {
    const size = pageSizeFrom(sp, DEFAULT_SIZE)
    const stack = stackFrom(sp)
    const params = walkParams(stack, size)
    let page
    if (filter?.kind === 'holder') {
      page = await api.addressTokenTransfers(filter.hash, { token: t.address_hash, ...params })
      // Blockscout counts a holder's transfers of all tokens together, not of one, so the count is known on the last page.
      total = page.next_page_params === null ? stack.length * size + page.items.length : null
    } else if (filter?.kind === 'id') {
      const [p, count] = await Promise.all([tokenApi.instanceTransfers(t.address_hash, filter.id, params), tokenApi.instanceTransfersCount(t.address_hash, filter.id)])
      page = p
      total = count.transfers_count
    } else {
      page = await api.tokenTransfers(t.address_hash, params)
      total = tokenTotal
    }
    items = page.items
    nav = walkNav({ base, keep, size, defaultSize: DEFAULT_SIZE, total, stack, next: page.next_page_params })
  }
  const holder = filter?.kind === 'holder' ? filter.hash : undefined
  const sheet = await tokenTransferSheet(items, filter === null ? t.address_hash : `${t.address_hash}-${filterParam(filter)}`, nav.page)
  const walked = (nav.page - 1) * nav.size
  return (
    <>
      <div className="card mb-3">
        <ListHead right={<ListTools sheet={sheet} nav={nav} />}>
          {total !== null ? (
            <>A total of {counted(total, 'transaction')} found</>
          ) : (
            <WalkCount walked={walked} rows={items.length} more={nav.next !== null} noun="transaction" />
          )}
          {note && <span className="d-block small text-muted">{note}</span>}
        </ListHead>
        <div className="card-body p-0">
          {nft ? (
            <NftTransferTable rows={rowsFromTransfers(items)} variant="token" me={holder} />
          ) : (
            <TokenTransferTable items={items} tokenPage={t.address_hash} me={holder} />
          )}
        </div>
        <ListFoot nav={nav} />
      </div>
      {/* The export covers the whole token; the filtered views have none of their own. */}
      {t.type === 'ERC-20' && filter === null && <CsvExportLine type="tokentxns" a={t.address_hash} />}
    </>
  )
}

/**
 * The Inventory tab (NFTs): the collection's items, highest id first. Blockscout serves them 50 at a time whatever
 * size is asked; the page reads as many as its size needs and continues after the last item shown (the cursor is
 * that item's id).
 */
async function Inventory({ t, sp }: { t: TokenInfo; sp: SP }) {
  const size = pageSizeFrom(sp, INVENTORY_SIZE)
  const stack = stackFrom(sp)
  const items: NftInstance[] = []
  let cursor: Cursor | undefined = stack.at(-1)
  let more = true
  while (items.length < size && more) {
    const page = await tokenApi.instances(t.address_hash, cursor)
    items.push(...page.items)
    more = page.next_page_params !== null
    if (page.next_page_params !== null) cursor = page.next_page_params
  }
  const shown = items.slice(0, size)
  const last = shown.at(-1)
  const next = (items.length > size || more) && last !== undefined ? { unique_token: last.id } : null
  const nav = walkNav({ base: `/token/${t.address_hash}`, keep: { tab: 'inventory' }, size, defaultSize: INVENTORY_SIZE, total: null, stack, next })
  const sheet: Sheet = {
    name: `export-inventory-${t.address_hash}-page${nav.page}.csv`,
    header: ['Token ID', 'Name', 'Owner'],
    rows: shown.map((it) => {
      const name = metadataName(it.metadata)
      return [it.id, name === null ? '' : name, it.owner === null ? '' : it.owner.hash]
    }),
  }
  return (
    <div className="card mb-3">
      <ListHead right={<ListTools sheet={sheet} nav={nav} />}>
        <WalkCount walked={(nav.page - 1) * size} rows={shown.length} more={next !== null} noun="token" />
      </ListHead>
      <div className="card-body">{shown.length === 0 ? <Empty /> : <InventoryGrid t={t} items={shown} />}</div>
      <ListFoot nav={nav} />
    </div>
  )
}

/** The holder's details for the "Filtered by Token Holder" card: Blockscout's record of the address and its balance. */
async function holderFacts(t: TokenInfo, holder: string): Promise<{ known: AddressInfo | null; balance: bigint | null }> {
  const [known, balance] = await Promise.all([
    api.address(holder).catch((e: unknown) => {
      // An address Blockscout has never seen (404) is still a valid filter: it simply has no transfers.
      if (e instanceof NotFoundError) return null
      throw e
    }),
    // ERC-1155 balances are per item id; there is no single balance to read.
    t.type === 'ERC-1155' ? Promise.resolve(null) : balanceOf(t.address_hash, holder),
  ])
  return { known, balance }
}

type TabKey = 'transfers' | 'holders' | 'inventory' | 'contract'

export default async function TokenPage({ params, searchParams }: { params: Promise<{ addr: string }>; searchParams: Promise<SP> }) {
  const { addr } = await params
  if (!isAddress(addr)) notFound()
  const sp = await searchParams
  const [t, info, counters] = await Promise.all([orNotFound(api.token(addr)), api.address(addr), tokenApi.counters(addr)])
  const nft = isNft(t)
  const filter = filterFrom(sp, nft)
  const base = `/token/${t.address_hash}`
  const withFilter = (extra: Record<string, string>) => {
    const q = new URLSearchParams(filter === null ? extra : { a: filterParam(filter), ...extra })
    const s = q.toString()
    return s ? `${base}?${s}` : base
  }
  const tabs: { key: TabKey; label: string; href: string; check?: boolean }[] = [{ key: 'transfers', label: 'Transfers', href: withFilter({}) }]
  if (filter === null) tabs.push({ key: 'holders', label: 'Holders', href: `${base}?tab=holders` })
  if (nft && filter === null) tabs.push({ key: 'inventory', label: 'Inventory', href: `${base}?tab=inventory` })
  if (info.is_contract) tabs.push({ key: 'contract', label: 'Contract', href: withFilter({ tab: 'contract' }), check: info.is_verified === true })
  const requested = one(sp, 'tab') ?? 'transfers'
  const active = tabs.find((x) => x.key === requested)
  if (!active) notFound()

  const holders = Number(counters.token_holders_count)
  const transfers = Number(counters.transfers_count)

  let filterCard: React.ReactNode = null
  if (filter?.kind === 'holder') {
    const facts = await holderFacts(t, filter.hash)
    filterCard = <HolderCard t={t} holder={filter.hash} known={facts.known} balance={facts.balance} />
  } else if (filter?.kind === 'tx') {
    filterCard = <TxFilterCard hash={filter.hash} />
  } else if (filter?.kind === 'id') {
    const [item, count] = await Promise.all([orNotFound(tokenApi.instance(t.address_hash, filter.id)), tokenApi.instanceTransfersCount(t.address_hash, filter.id)])
    filterCard = <TokenIdCard t={t} id={filter.id} name={metadataName(item.metadata)} owner={item.owner} transfers={count.transfers_count} />
  }

  return (
    <div className="container-xxl">
      <TokenHead t={t} />
      <TokenProfile t={t} verified={info.is_verified === true} />
      <TokenCards t={t} holders={holders} transfers={transfers} />
      {filterCard}
      <div className="tk-tabrow">
        <Tabs tabs={tabs} active={active.key} />
        <TokenFilter action={base} placeholder={nft ? 'Filter Address / Txn Hash / Token ID' : 'Filter Address / Txn Hash'} value={filter === null ? undefined : filterParam(filter)} />
      </div>
      {active.key === 'transfers' && <Transfers t={t} sp={sp} filter={filter} tokenTotal={transfers} nft={nft} />}
      {active.key === 'holders' && <Holders t={t} sp={sp} total={holders} />}
      {active.key === 'inventory' && <Inventory t={t} sp={sp} />}
      {active.key === 'contract' && <ContractTab a={info} file={Number(one(sp, 'file') ?? '0')} />}
      <Note>
        A token is a contract that keeps its own ledger of balances. This page shows the token&apos;s supply, its holders and every transfer recorded on{' '}
        {SITE.chainName}; prices appear only where a market source exists.
      </Note>
    </div>
  )
}
