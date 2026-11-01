import { Fuel, Settings } from 'lucide-react'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { api } from '@/lib/api'
import { gasFees, gasTitle, gweiText } from '@/lib/chrome-api'
import { pct, usd } from '@/lib/format'
import { SITE } from '@/lib/site'
import type { Stats } from '@/lib/types'
import { MainNav, NetworkMenu, ThemeMenu } from './chrome-menus'
import { HeaderSearchSlot } from './HeaderSearchSlot'

/**
 * The header is on every page; an unreachable backend or node must not take navigation down with it. Each figure
 * falls back to "-", the page body still fails loudly through its own data calls, and the outage is logged.
 */
async function orNull<T>(what: string, load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch (e) {
    // Next's own control-flow signals (dynamic bailout, redirect, notFound) must pass through untouched.
    unstable_rethrow(e)
    console.error(`header ${what} unavailable:`, e instanceof Error ? e.message : e)
    return null
  }
}

export async function Header() {
  const [stats, gas] = await Promise.all([orNull<Stats>('stats', api.stats), orNull('gas', gasFees)])
  const price = stats?.coin_price ? Number(stats.coin_price) : null
  const change = stats?.coin_price_change_percentage ?? null

  return (
    <>
      {/* section#masterTopBar: the sticky strip; the navbar below scrolls away. */}
      <section id="masterTopBar" className="ex-topbar d-print-none">
        <div className="container-xxl d-flex align-items-center justify-content-between">
          <div className="ex-topbar-stats d-none d-md-flex align-items-center gap-4 w-100">
            <div className="text-muted">
              {SITE.coin} Price:{' '}
              {price !== null ? (
                <>
                  <Link href="/charts">{usd(price)}</Link>
                  {change !== null && (
                    <span className={change >= 0 ? 'text-success' : 'text-danger'} title="Changes in the last 24 hours">
                      {' '}
                      ({pct(change)})
                    </span>
                  )}
                </>
              ) : (
                '-'
              )}
            </div>
            <div className="text-muted d-none d-lg-block">
              <Fuel size={13} className="me-1" aria-hidden="true" />
              Gas:{' '}
              {gas !== null ? (
                <span title={gasTitle(gas)}>
                  <Link href="/gastracker">{gweiText(gas.base + gas.priority)}</Link>
                </span>
              ) : (
                '-'
              )}
            </div>
          </div>
          <div className="d-flex justify-content-end align-items-center gap-2 w-100">
            <HeaderSearchSlot />
            <Link href="/settings" className="btn btn-white ex-topbtn d-none d-lg-inline-flex" aria-label="Site Settings" title="Site Settings">
              <Settings size={16} aria-hidden="true" />
            </Link>
            <ThemeMenu />
            <NetworkMenu />
          </div>
        </div>
      </section>
      <header id="masterHeader" className="ex-header d-print-none">
        <MainNav />
      </header>
    </>
  )
}
