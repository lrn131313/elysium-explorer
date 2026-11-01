import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DownloadPageData } from '@/components/client'
import { ContractTab } from '@/components/contract'
import { CsvExportLine, ListHead, ViewAll } from '@/components/list'
import { InternalTable, TokenTransferTable, TxTable, internalSheet, tokenTransferSheet, txSheet } from '@/components/tables'
import { Note, Tabs } from '@/components/ui'
import { heldTokens, moreInfo } from '@/lib/address-api'
import { api } from '@/lib/api'
import { addressTxCount } from '@/lib/lists-api'
import { counted, isAddress, mid, num } from '@/lib/format'
import { one, orNotFound, type SP } from '@/lib/page'
import type { AddressInfo } from '@/lib/types'
import { AssetsTab } from './assets'
import { EventsTab } from './events'
import { AddressHeader, BadgeRow } from './header'
import { MoreInfoCard, OverviewCard } from './overview'
import { TxFilter } from './tx-filter'

export async function generateMetadata({ params }: { params: Promise<{ addr: string }> }) {
  return { title: `Address ${mid((await params).addr, 10, 8)}` }
}

type TabKey = 'txs' | 'internal' | 'tokentxns' | 'contract' | 'events' | 'assets'

/** How many rows an address tab shows; the full, paged list is one "View all" away, as on Etherscan. */
const LATEST = 25

async function TabBody({ a, tab, sp, txTotal }: { a: AddressInfo; tab: TabKey; sp: SP; txTotal: number }) {
  if (tab === 'txs') {
    const page = await api.addressTxs(a.hash, { items_count: LATEST })
    const all = `/txs?a=${a.hash}`
    return (
      <>
        <div className="card mb-3">
          {page.items.length > 0 && (
            <ListHead
              right={
                <>
                  <DownloadPageData sheet={await txSheet(page.items, a.hash, 1)} />
                  <TxFilter hash={a.hash} />
                </>
              }
            >
              Latest {page.items.length} from a total of{' '}
              <Link href={all} title="Click to view full list">
                {num(txTotal)}
              </Link>{' '}
              {txTotal === 1 ? 'transaction' : 'transactions'}
            </ListHead>
          )}
          <div className="card-body p-0">
            <TxTable txs={page.items} me={a.hash} />
          </div>
          {page.items.length > 0 && <ViewAll href={all}>View all transactions</ViewAll>}
        </div>
        <CsvExportLine type="address" a={a.hash} />
      </>
    )
  }
  if (tab === 'internal') {
    // Etherscan lists value-carrying calls and contract creations only, not zero-value calls or staticcalls.
    const page = await api.addressInternalValued(a.hash, LATEST, {})
    const all = `/txsInternal?a=${a.hash}`
    return (
      <>
        <div className="card mb-3">
          {page.items.length > 0 && (
            <ListHead right={<DownloadPageData sheet={await internalSheet(page.items, a.hash, 1)} />}>
              Latest {counted(page.items.length, 'internal transaction')} (<Link href={all}>View All</Link>)
            </ListHead>
          )}
          <div className="card-body p-0">
            <InternalTable items={page.items} me={a.hash} />
          </div>
          {page.items.length > 0 && <ViewAll href={all}>View all internal transactions</ViewAll>}
        </div>
        <CsvExportLine type="internaltxns" a={a.hash} />
      </>
    )
  }
  if (tab === 'tokentxns') {
    const page = await api.addressErc20Transfers(a.hash, { items_count: LATEST })
    const all = `/tokentxns?a=${a.hash}`
    return (
      <>
        <div className="card mb-3">
          {page.items.length > 0 && (
            <ListHead right={<DownloadPageData sheet={await tokenTransferSheet(page.items, a.hash, 1)} />}>
              Latest {counted(page.items.length, 'ERC-20 Token Transfer Event')}
            </ListHead>
          )}
          <div className="card-body p-0">
            <TokenTransferTable items={page.items} me={a.hash} />
          </div>
          {page.items.length > 0 && <ViewAll href={all}>View all token transfers</ViewAll>}
        </div>
        <CsvExportLine type="addresstokentxns" a={a.hash} />
      </>
    )
  }
  if (tab === 'events') return <EventsTab a={a} sp={sp} />
  if (tab === 'assets') return <AssetsTab a={a} sp={sp} />
  // `file`: which source file the viewer opens (its "copy link to this file" button writes it); a whole number or absent.
  const rawFile = one(sp, 'file')
  if (rawFile !== undefined && !/^\d{1,4}$/.test(rawFile)) notFound()
  return <ContractTab a={a} file={rawFile === undefined ? 0 : Number(rawFile)} />
}

/**
 * Etherscan's tabs in robin's order: Transactions · Internal Transactions · Token Transfers (ERC-20) · Contract (green
 * tick when verified) · Events · Assets; a wallet has no Contract or Events. Left out: "Other Transactions" (cross-chain
 * bridge transfers: this chain's only bridge, the Orbit rollup bridge, gives Blockscout no per-address sender,
 * recipient or token), "Cards" (Etherscan's own widgets), NFT Transfers / Analytics / Info (mainnet only).
 */
function tabsFor(a: AddressInfo): { key: TabKey; label: string; href: string; check?: boolean }[] {
  const base = `/address/${a.hash}`
  const tabs: { key: TabKey; label: string; href: string; check?: boolean }[] = [
    { key: 'txs', label: 'Transactions', href: base },
    { key: 'internal', label: 'Internal Transactions', href: `${base}?tab=internal` },
    { key: 'tokentxns', label: 'Token Transfers (ERC-20)', href: `${base}?tab=tokentxns` },
  ]
  if (a.is_contract) {
    tabs.push({ key: 'contract', label: 'Contract', href: `${base}?tab=contract`, check: a.is_verified === true })
    tabs.push({ key: 'events', label: 'Events', href: `${base}?tab=events` })
  }
  tabs.push({ key: 'assets', label: 'Assets', href: `${base}?tab=assets` })
  return tabs
}

export default async function AddressPage({ params, searchParams }: { params: Promise<{ addr: string }>; searchParams: Promise<SP> }) {
  const { addr } = await params
  if (!isAddress(addr)) notFound()
  const sp = await searchParams
  const a = await orNotFound(api.address(addr))
  // The same total /txs?a= shows ("View all"): exact within the legacy window, Blockscout's lagging counter past it.
  const txTotal = (await addressTxCount(a)).count
  const tabs = tabsFor(a)
  const requested = one(sp, 'tab')
  const active = tabs.find((t) => t.key === (requested === undefined ? 'txs' : requested))
  if (!active) notFound()
  const tab = active.key

  const [held, info] = await Promise.all([heldTokens(a.hash), moreInfo(a)])

  return (
    <div className="container-xxl">
      <AddressHeader a={a} />
      <BadgeRow a={a} />
      {/* Etherscan's third card, "Multichain Info", is a cross-chain portfolio service; one chain has nothing to show there. */}
      <div className="row g-3 mb-4">
        <OverviewCard a={a} held={held} />
        <MoreInfoCard a={a} info={info} />
      </div>

      <Tabs tabs={tabs} active={tab} />
      <TabBody a={a} tab={tab} sp={sp} txTotal={txTotal} />
      {/* Etherscan's page notes, without their closing "Learn more … in our Knowledge Base" link (theirs). */}
      <Note>
        {a.is_contract
          ? 'A contract address hosts a smart contract, which is a set of code stored on the blockchain that runs when predetermined conditions are met.'
          : 'A wallet address is a publicly available address that allows its owner to receive funds from another party. To access the funds in an address, you must have its private key.'}
      </Note>
    </div>
  )
}
