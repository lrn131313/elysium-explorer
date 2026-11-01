import { ArrowRight, Box, Coins, FileText, Gauge, Globe, Server } from 'lucide-react'
import Link from 'next/link'
import { AddressLink } from '@/components/AddressLink'
import { AutoRefresh, TimeAgo } from '@/components/client'
import { HeroSearch } from '@/components/SearchBox'
import { TxChart } from '@/components/TxChart'
import { api, safeAndFinalized } from '@/lib/api'
import { gasFees, gasTitle, gweiText, txStats24h } from '@/lib/chrome-api'
import { formatUnits, num, pct, usd } from '@/lib/format'
import { SITE } from '@/lib/site'
import type { Block } from '@/lib/types'

export const dynamic = 'force-dynamic'

const DAY_SECONDS = 86_400

/** Block interval: this block's time minus the previous one's (list is newest first). */
function interval(blocks: Block[], i: number): string | null {
  const b = blocks[i]
  const prev = blocks[i + 1]
  if (!b || !prev || prev.height !== b.height - 1) return null
  const s = Math.round((Date.parse(b.timestamp) - Date.parse(prev.timestamp)) / 1000)
  return `${s} ${s === 1 ? 'sec' : 'secs'}`
}

// On a Nitro chain "safe" and "finalized" follow the parent chain, not validator votes (research/chrome.md §4).
const SAFE_TITLE = `This block's batch has been posted to ${SITE.parentChain}; it is unlikely to be reverted.`
const FINALIZED_TITLE = `This block's batch is in a finalized ${SITE.parentChain} block and cannot be reverted.`

export default async function Home() {
  // The main-page endpoint returns only 4 blocks; the paged list gives the 6 shown + 1 for the last interval.
  const [stats, day, gas, chart, blockPage, txs, tags] = await Promise.all([
    api.stats(),
    txStats24h(),
    gasFees(),
    api.txChart(),
    api.blocks(),
    api.latestTxs(),
    safeAndFinalized(),
  ])
  const blocks = blockPage.items
  const price = stats.coin_price ? Number(stats.coin_price) : null
  const change = stats.coin_price_change_percentage
  // Transactions per second over the last 24 hours (Blockscout's rolling count).
  const tps = (Number(day.transactions_count_24h) / DAY_SECONDS).toFixed(1)

  return (
    <>
      <AutoRefresh seconds={6} />
      <section className="ex-hero">
        <div className="container-xxl">
          <div className="row">
            <div className="col-md-9 col-lg-7">
              <h1>{SITE.tagline}</h1>
              <HeroSearch />
              <p className="ex-hero-sub">
                Chain ID {SITE.chainId} &middot; Arbitrum Orbit chain settling on {SITE.parentChain} &middot; gas paid in {SITE.coin}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container-xxl">
        <div className="card ex-home-stats">
          <div className="row">
            <div className="col-md-6 col-lg-4">
              <div className="d-flex align-items-center">
                <span className="ex-ico">
                  <Coins size={20} aria-hidden="true" />
                </span>
                <div>
                  <div className="text-cap">{SITE.coin} Price</div>
                  {price !== null ? (
                    <span className="ex-val">
                      {usd(price)}
                      {change !== null && (
                        <span className={`small ${change >= 0 ? 'text-success' : 'text-danger'}`} title="Changes in the last 24 hours">
                          {' '}
                          ({pct(change)})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="ex-val">-</span>
                  )}
                </div>
              </div>
              <hr />
              <div className="d-flex align-items-center">
                <span className="ex-ico">
                  <Globe size={20} aria-hidden="true" />
                </span>
                <div>
                  <div className="text-cap">Market Cap</div>
                  <span className="ex-val">{stats.market_cap !== null && Number(stats.market_cap) > 0 ? usd(Number(stats.market_cap)) : '-'}</span>
                </div>
              </div>
              <hr className="d-md-none" />
            </div>

            <div className="col-md-6 col-lg-4 ex-border-md-start">
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                  <span className="ex-ico">
                    <Server size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-cap">Transactions</div>
                    <Link href="/txs" className="ex-val" title="Total Transactions Counter">
                      {num(stats.total_transactions)}
                    </Link>{' '}
                    <span className="ex-val-note text-muted" title="Transactions per second, averaged over the last 24 hours">
                      ({tps} TPS)
                    </span>
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-cap">Med Gas Price</div>
                  <Link href="/gastracker" className="ex-val" title={gasTitle(gas)}>
                    {gweiText(gas.base + gas.priority)}
                  </Link>
                </div>
              </div>
              <hr />
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                  <span className="ex-ico">
                    <Gauge size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-cap">Last Finalized Block</div>
                    <Link href={`/block/${tags.finalized}`} className="ex-val" title={FINALIZED_TITLE}>
                      {tags.finalized}
                    </Link>
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-cap">Last Safe Block</div>
                  <Link href={`/block/${tags.safe}`} className="ex-val" title={SAFE_TITLE}>
                    {tags.safe}
                  </Link>
                </div>
              </div>
              <hr className="d-lg-none" />
            </div>

            <div className="col-lg-4 ex-border-lg-start">
              <div className="text-cap">Transaction History in 14 Days</div>
              <TxChart points={chart.chart_data} />
            </div>
          </div>
        </div>

        <div className="row ex-latest">
          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-header">
                <h2>Latest Blocks</h2>
              </div>
              <div className="card-body">
                {blocks.slice(0, 6).map((b, i) => {
                  const iv = interval(blocks, i)
                  return (
                    <div key={b.hash}>
                      {i > 0 && <hr />}
                      <div className="row">
                        <div className="col-sm-4">
                          <div className="d-flex align-items-center gap-2">
                            <span className="ex-tile">
                              <Box size={18} aria-hidden="true" />
                            </span>
                            <div className="d-flex flex-row flex-sm-column align-items-center align-items-sm-start gap-1 gap-sm-0">
                              <span className="d-sm-none">Block</span>
                              <Link href={`/block/${b.height}`} className="ex-cut" style={{ maxWidth: '6rem' }}>
                                {b.height}
                              </Link>
                              <div className="small text-muted">
                                <TimeAgo ts={b.timestamp} />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-sm-8 d-flex justify-content-sm-between align-items-end align-items-sm-center">
                          <div className="pe-sm-2 text-truncate">
                            <div className="d-flex flex-wrap gap-1">
                              Fee Recipient <AddressLink a={b.miner} head={8} tail={4} />
                            </div>
                            <Link href={`/txs?block=${b.height}`} title="Transactions in this Block">
                              {b.transactions_count} {b.transactions_count === 1 ? 'txn' : 'txns'}
                            </Link>
                            {iv && <span className="small text-muted"> in {iv}</span>}
                          </div>
                          {b.transaction_fees !== null && (
                            <div className="d-none d-sm-block text-end">
                              <span className="ex-amount" title="Transaction fees in this block">
                                {formatUnits(b.transaction_fees, 18, { maxFraction: 5 })} {SITE.coin}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <Link href="/blocks" className="card-footer ex-viewall">
                View all blocks <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-header">
                <h2>Latest Transactions</h2>
              </div>
              <div className="card-body">
                {txs.slice(0, 6).map((t, i) => (
                  <div key={t.hash}>
                    {i > 0 && <hr />}
                    <div className="row">
                      <div className="col-sm-4 col-lg-5">
                        <div className="d-flex align-items-center gap-2">
                          <span className="ex-tile">
                            <FileText size={18} aria-hidden="true" />
                          </span>
                          <div className="d-flex flex-row flex-sm-column align-items-center align-items-sm-start gap-1 gap-sm-0">
                            <span className="d-sm-none">TX#</span>
                            <Link href={`/tx/${t.hash}`} className="ex-cut font-mono" style={{ maxWidth: '7rem' }}>
                              {t.hash}
                            </Link>
                            <div className="small text-muted">{t.timestamp && <TimeAgo ts={t.timestamp} />}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-sm-8 col-lg-7 d-flex justify-content-sm-between align-items-end align-items-sm-center">
                        <div className="pe-sm-2 text-truncate">
                          <div className="d-flex flex-wrap gap-1">
                            From <AddressLink a={t.from} head={8} tail={4} />
                          </div>
                          <div className="d-flex flex-wrap gap-1">
                            To{' '}
                            {t.to ? (
                              <AddressLink a={t.to} head={8} tail={4} />
                            ) : t.created_contract ? (
                              <>
                                Create: <AddressLink a={t.created_contract} head={8} tail={4} />
                              </>
                            ) : (
                              '-'
                            )}
                          </div>
                        </div>
                        <div className="d-none d-sm-block text-end">
                          <span className="ex-amount" title="Amount">
                            {formatUnits(t.value, 18, { maxFraction: 5 })} {SITE.coin}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/txs" className="card-footer ex-viewall">
                View all transactions <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
