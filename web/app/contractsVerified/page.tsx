import { LayoutGrid, Wrench, Zap } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HashCell, Help, StatTile } from '@/components/chain-cells'
import { ListFoot, ListHead, ListTools, WalkCount } from '@/components/list'
import { EmptyRow, Note, PageHead } from '@/components/ui'
import {
  contractCounters,
  isContractsCursor,
  verifiedContracts,
  type ContractLanguage,
  type LicenseType,
  type VerifiedContract,
} from '@/lib/chain-api'
import type { Sheet } from '@/lib/csv'
import { formatUnits, listCoin, num } from '@/lib/format'
import { one, type SP } from '@/lib/page'
import { pageSizeFrom, stackFrom, walkNav, walkParams, type PageSize } from '@/lib/paging'
import { SITE } from '@/lib/site'

export const metadata = { title: 'Verified Contracts' }

const DEFAULT_SIZE: PageSize = 25
/** Etherscan's search box takes up to 60 characters. */
const MAX_QUERY = 60

/** Etherscan's `filter` values for this list and the compiler language each one means in Blockscout. */
const FILTERS = {
  solc: { language: 'solidity', label: 'Solidity Compiler' },
  vyper: { language: 'vyper', label: 'Vyper Compiler' },
} as const satisfies Record<string, { language: ContractLanguage; label: string }>
type FilterKey = keyof typeof FILTERS
const isFilter = (s: string): s is FilterKey => Object.hasOwn(FILTERS, s)

const LANGUAGE: Record<ContractLanguage, string> = {
  solidity: 'Solidity',
  vyper: 'Vyper',
  yul: 'Yul',
  geas: 'Geas',
  stylus_rust: 'Stylus (Rust)',
}

/** The licence names Etherscan writes for each of Blockscout's licence values; "none" is shown as "-". */
const LICENSE: Record<Exclude<LicenseType, 'none'>, string> = {
  unlicense: 'Unlicense',
  mit: 'MIT',
  gnu_gpl_v2: 'GNU GPLv2',
  gnu_gpl_v3: 'GNU GPLv3',
  gnu_lgpl_v2_1: 'GNU LGPLv2.1',
  gnu_lgpl_v3: 'GNU LGPLv3',
  bsd_2_clause: 'BSD-2-Clause',
  bsd_3_clause: 'BSD-3-Clause',
  mpl_2_0: 'MPL-2.0',
  osl_3_0: 'OSL-3.0',
  apache_2_0: 'Apache-2.0',
  gnu_agpl_v3: 'GNU AGPLv3',
  bsl_1_1: 'BSL 1.1',
}

const license = (l: LicenseType | null) => (l === null || l === 'none' ? '-' : LICENSE[l])

/**
 * "0.8.30" from "v0.8.30+commit.73712a01", as Etherscan writes it. ArbOS's built-in contracts have no compiler; Blockscout
 * describes them in words ("L2 Precompile (go 1.17)"), shown as they are.
 */
function version(v: string | null): string {
  if (v === null) return '-'
  return v.replace(/^v?(\d+\.\d+\.\d+)(?:[+-].*)?$/, '$1')
}

/** "6/6/2026": Etherscan's verified date (UTC). */
function day(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`
}

const txns = (c: VerifiedContract) => (c.transactions_count === null ? '-' : num(c.transactions_count))

function settings(c: VerifiedContract): string[] {
  const out: string[] = []
  if (c.optimization_enabled === true) out.push('Optimization Enabled')
  if (c.has_constructor_args) out.push('Constructor Arguments')
  return out
}

function Setting({ c }: { c: VerifiedContract }) {
  const list = settings(c)
  if (list.length === 0) return <>-</>
  return (
    <span className="d-inline-flex gap-1">
      {list.map((s) => (
        <span key={s} className="chain-setting" title={s}>
          {s === 'Optimization Enabled' ? <Zap size={11} aria-label={s} /> : <Wrench size={11} aria-label={s} />}
        </span>
      ))}
    </span>
  )
}

/** Etherscan's /contractsVerified: the newest verified contracts; `filter` narrows it by compiler, `q` by contract name. */
export default async function ContractsVerified({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const rawFilter = one(sp, 'filter')
  if (rawFilter !== undefined && !isFilter(rawFilter)) notFound()
  const filter = rawFilter === undefined ? null : rawFilter
  const rawQ = one(sp, 'q')
  if (rawQ !== undefined && rawQ.length > MAX_QUERY) notFound()
  const q = rawQ === undefined || rawQ.trim() === '' ? null : rawQ.trim()
  const size = pageSizeFrom(sp, DEFAULT_SIZE)
  const stack = stackFrom(sp)
  if (!stack.every(isContractsCursor)) notFound()
  const [page, counters] = await Promise.all([
    verifiedContracts(walkParams(stack, size), filter === null ? null : FILTERS[filter].language, q),
    contractCounters(),
  ])
  const more = page.next_page_params !== null
  const walked = stack.length * size
  const keep: Record<string, string> = {}
  if (filter !== null) keep.filter = filter
  if (q !== null) keep.q = q
  const unfiltered = filter === null && q === null
  const nav = walkNav({
    base: '/contractsVerified',
    keep,
    size,
    defaultSize: DEFAULT_SIZE,
    // The whole list has a count (Blockscout's counters); a filtered one is counted only once walked to its end.
    total: unfiltered ? Number(counters.verified_smart_contracts) : more ? null : walked + page.items.length,
    stack,
    next: page.next_page_params,
  })
  const sheet: Sheet = {
    name: `export-verified-contracts-page${nav.page}.csv`,
    header: ['Address', 'Contract Name', 'Compiler', 'Version', `Balance (${SITE.coin})`, 'Txns', 'Setting', 'Verified', 'License'],
    rows: page.items.map((c) => [
      c.address.hash,
      c.address.name === null ? '' : c.address.name,
      LANGUAGE[c.language],
      c.compiler_version === null ? '' : c.compiler_version,
      formatUnits(c.coin_balance, 18, { grouped: false }),
      c.transactions_count === null ? '' : String(c.transactions_count),
      settings(c).join('; '),
      day(c.verified_at),
      license(c.license_type),
    ]),
  }
  return (
    <div className="container-xxl">
      <PageHead title="Verified Contracts" />
      <div className="row g-3 mb-3">
        <div className="col-sm-6 col-lg-3">
          <StatTile label="Contracts Deployed (Total)">{num(counters.smart_contracts)}</StatTile>
        </div>
        <div className="col-sm-6 col-lg-3">
          <StatTile label="Contracts Deployed (24h)">{num(counters.new_smart_contracts_24h)}</StatTile>
        </div>
        <div className="col-sm-6 col-lg-3">
          <StatTile label="Contracts Verified (Total)">{num(counters.verified_smart_contracts)}</StatTile>
        </div>
        <div className="col-sm-6 col-lg-3">
          <StatTile label="Contracts Verified (24h)">{num(counters.new_verified_smart_contracts_24h)}</StatTile>
        </div>
      </div>
      <div className="card">
        <div className="card-header chain-filters">
          <details className="chain-dropdown">
            <summary className="btn btn-sm btn-white dropdown-toggle">
              Filter by | <LayoutGrid size={14} aria-hidden="true" />
              {filter === null ? 'Verified Contracts' : FILTERS[filter].label}
            </summary>
            <div className="dropdown-menu show">
              <Link className="dropdown-item" href="/contractsVerified">
                Verified Contracts
              </Link>
              <hr className="dropdown-divider" />
              {(Object.keys(FILTERS) as FilterKey[]).map((k) => (
                <Link key={k} className="dropdown-item" href={`/contractsVerified?filter=${k}`}>
                  {FILTERS[k].label}
                </Link>
              ))}
            </div>
          </details>
          <form action="/contractsVerified" method="get" className="input-group input-group-sm chain-search" role="search">
            {filter !== null && <input type="hidden" name="filter" value={filter} />}
            <input
              name="q"
              type="search"
              maxLength={MAX_QUERY}
              defaultValue={q === null ? '' : q}
              className="form-control"
              placeholder="Search Contract Name"
              aria-label="Search Contract Name"
            />
            <button type="submit" className="btn btn-primary" title="Search Contract Name">
              Find
            </button>
          </form>
        </div>
        <ListHead right={<ListTools sheet={sheet} nav={nav} />}>
          {unfiltered ? (
            <>A total of {num(counters.verified_smart_contracts)} verified contracts found</>
          ) : (
            <WalkCount walked={walked} rows={page.items.length} more={more} noun="verified contract" />
          )}
          {q !== null && <span className="ex-list-sub">(Contract name or address matching &quot;{q}&quot;)</span>}
        </ListHead>
        <div className="card-body p-0">
          <div className="ex-table-wrap">
            <table className="ex-table">
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Contract Name</th>
                  <th>Compiler</th>
                  <th>Version</th>
                  <th>Balance</th>
                  <th>Txns</th>
                  <th>Setting</th>
                  <th>Verified</th>
                  <th>
                    License <Help tip="Contract Source Code License Type" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.items.length === 0 && <EmptyRow cols={9} />}
                {page.items.map((c) => (
                  <tr key={c.address.hash}>
                    <td>
                      <HashCell a={c.address} name={null} href={`/address/${c.address.hash}?tab=contract`} />
                    </td>
                    <td>{c.address.name === null ? '-' : c.address.name}</td>
                    <td>{LANGUAGE[c.language]}</td>
                    <td>
                      <span title={c.compiler_version === null ? undefined : c.compiler_version}>{version(c.compiler_version)}</span>
                    </td>
                    <td>
                      <span title={`${formatUnits(c.coin_balance, 18)} ${SITE.coin}`}>
                        {listCoin(c.coin_balance)} {SITE.coin}
                      </span>
                    </td>
                    <td>{txns(c)}</td>
                    <td>
                      <Setting c={c} />
                    </td>
                    <td>{day(c.verified_at)}</td>
                    <td>{license(c.license_type)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <ListFoot nav={nav} />
      </div>
      <Note>
        A verified contract has published source code that compiles to the code running on {SITE.chainName}. Entries whose
        version reads &quot;L2 Precompile&quot;, &quot;EVM Hypervisor&quot; or &quot;Not installed&quot; are ArbOS&apos;s built-in
        contracts at fixed addresses: their interfaces are published, but they are part of the chain&apos;s own software, not
        compiled from Solidity.
      </Note>
    </div>
  )
}
