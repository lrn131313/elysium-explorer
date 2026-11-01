import Link from 'next/link'
import { cache } from 'react'
import { AddressLink } from '@/components/AddressLink'
import { Help } from '@/components/chain-cells'
import { CustomGasRow, RefreshCountdown } from '@/components/chain-client'
import { gasUsd } from '@/components/chain-format'
import { EmptyRow, Note } from '@/components/ui'
import { api } from '@/lib/api'
import { gasGuzzlers, gasOracle, recentBlocks, type GasTier } from '@/lib/chain-api'
import { formatUnits, listDate, num } from '@/lib/format'
import { SITE } from '@/lib/site'

/** Seconds between refreshes, as on Etherscan. */
const REFRESH = 10
/** Blocks behind "Avg Block Size", as Etherscan's "Based on last 5 blocks". */
const SIZE_BLOCKS = 5

/** One read of the node per request, shared by the page and its <title>. */
const oracle = cache(gasOracle)

const gweiText = (wei: bigint) => formatUnits(wei, 9)

export async function generateMetadata() {
  const o = await oracle()
  return { title: `${gweiText(o.standard.base + o.standard.priority)} Gwei | ${SITE.chainName} Gas Tracker` }
}

const TIERS = [
  { key: 'standard', label: 'Standard', className: 'chain-gas-standard' },
  { key: 'fast', label: 'Fast', className: 'chain-gas-fast' },
  { key: 'rapid', label: 'Rapid', className: 'chain-gas-rapid' },
] as const

const price = (t: GasTier) => t.base + t.priority

/** Etherscan's /gastracker: what gas costs now, from our own node, and which contracts burn the most of it. */
export default async function GasTracker() {
  const [o, stats, blocks, guzzlers] = await Promise.all([oracle(), api.stats(), recentBlocks(SIZE_BLOCKS), gasGuzzlers()])
  const rate = stats.coin_price === null ? null : Number(stats.coin_price)
  const tierPrices = TIERS.map((t) => ({ ...t, tier: o[t.key] }))
  const avgSize = blocks.items.length === 0 ? null : blocks.items.reduce((s, b) => s + b.transactions_count, 0) / blocks.items.length
  const transferGas = Number(o.transferGas)
  const top = guzzlers.items[0]
  const topGas = top === undefined ? 0n : BigInt(top.total_gas_used)
  const refreshed = listDate(Date.now())
  return (
    <>
      <section className="ex-hero chain-gas-hero">
        <div className="container-xxl text-center">
          <h1>{SITE.chainName} Gas Tracker</h1>
        </div>
      </section>
      <div className="container-xxl chain-gas-overlap">
        <div className="fw-medium text-white mb-3">
          Next update in <RefreshCountdown seconds={REFRESH} />
        </div>
        <div className="row g-3 mb-4">
          {tierPrices.map((t) => (
            <div key={t.key} className="col-md-4">
              <div className="card h-100">
                <div className="card-body d-flex flex-column text-center gap-3">
                  <h2 className="h6 mb-0">{t.label}</h2>
                  <div className={`h4 mb-0 ${t.className}`}>{gweiText(price(t.tier))} gwei</div>
                  <div className="text-muted">
                    Base: {gweiText(t.tier.base)} | Priority: {gweiText(t.tier.priority)}
                    <br />
                    <span title={`A plain ${SITE.coin} transfer: ${num(transferGas)} gas`}>
                      {rate === null ? '-' : gasUsd(transferGas, price(t.tier).toString(), rate)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-body">
                <h2 className="fs-6 fw-medium">Additional Info</h2>
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <div className="h-100 chain-info-tile rounded p-3">
                      <h3 className="ex-cap mb-1">Last Block</h3>
                      <div className="fw-medium lh-1">
                        <Link href={`/block/${o.head}`}>{o.head}</Link>
                      </div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="h-100 chain-info-tile rounded p-3">
                      <h3 className="ex-cap mb-1 d-flex align-items-center gap-1">
                        Avg Block Size <Help tip={`Transactions per block, based on the last ${SIZE_BLOCKS} blocks`} />
                      </h3>
                      <div className="fw-medium lh-1">{avgSize === null ? '-' : num(avgSize.toFixed(1).replace(/\.0$/, ''))}</div>
                    </div>
                  </div>
                </div>
                <p className="small text-muted mb-0">Last Refreshed: {refreshed} UTC</p>
              </div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-body">
                <h2 className="fs-6 fw-medium">Featured Actions</h2>
                <div className="ex-table-wrap">
                  <table className="ex-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        {TIERS.map((t) => (
                          <th key={t.key}>{t.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <span className="d-inline-flex align-items-center gap-1">
                            <Help tip={`Estimated based on Gas Limit of ${num(transferGas)}`} />
                            Transfer ({SITE.coin})
                          </span>
                        </td>
                        {tierPrices.map((t) => (
                          <td key={t.key}>{rate === null ? '-' : gasUsd(transferGas, price(t.tier).toString(), rate)}</td>
                        ))}
                      </tr>
                      <CustomGasRow tiers={tierPrices.map((t) => ({ key: t.key, wei: price(t.tier).toString() }))} rate={rate} />
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header ex-list-head">
            <div className="ex-list-info">
              <b>Top 50 Gas Guzzlers</b> <span className="text-muted">(Contracts that used the most gas in the last 3 hours)</span>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="ex-table-wrap">
              <table className="ex-table">
                <thead>
                  <tr>
                    <th className="text-center">Rank</th>
                    <th>Address</th>
                    <th>Gas Used 3hrs</th>
                    <th>Txns 3hrs</th>
                  </tr>
                </thead>
                <tbody>
                  {guzzlers.items.length === 0 && <EmptyRow cols={4} />}
                  {guzzlers.items.map((g, i) => {
                    const gas = BigInt(g.total_gas_used)
                    // Etherscan's bar under the figure: this contract's gas as a share of the top one's.
                    const bar = topGas === 0n ? 0 : Number((gas * 100n) / topGas)
                    return (
                      <tr key={g.contract_address.hash}>
                        <td className="text-center text-muted">{i + 1}</td>
                        <td>
                          <AddressLink a={g.contract_address} copy />
                        </td>
                        <td>
                          {num(gas)}
                          <div className="progress chain-gas-bar" role="presentation">
                            <div className="progress-bar" style={{ width: `${bar}%` }} />
                          </div>
                        </td>
                        <td>{num(g.transactions_count)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <Note>
          Prices are read from our own {SITE.chainName} node: the base fee the next block charges and the priority fees paid
          in the last 200 blocks that carried transactions (35th, 60th and 90th percentile). Dollar costs use the current{' '}
          {SITE.coin} price. Gas Guzzlers covers the last 3 hours only: Blockscout's longer windows are not filled on this
          instance.
        </Note>
      </div>
    </>
  )
}
