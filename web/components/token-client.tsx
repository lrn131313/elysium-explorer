'use client'

import { ChartBarDecreasing, ChartPie, ChevronDown, List, ListChecks, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/** Open/close state for a small dropdown that closes on a click outside it or on Escape. */
function useDropdown() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && e.target instanceof Node && !box.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return { open, setOpen, box }
}

interface Eip1193 {
  request(args: { method: string; params?: unknown }): Promise<unknown>
}

function isEip1193(x: unknown): x is Eip1193 {
  return typeof x === 'object' && x !== null && 'request' in x && typeof x.request === 'function'
}

/** The browser wallet (MetaMask and others inject `window.ethereum`), or null when there is none. */
function wallet(): Eip1193 | null {
  const eth: unknown = Reflect.get(window, 'ethereum')
  return isEip1193(eth) ? eth : null
}

/** EIP-1193 errors carry a numeric `code`: 4001 = the user said no, 4902 = the wallet does not know the chain. */
const errorCode = (e: unknown): number | null =>
  typeof e === 'object' && e !== null && 'code' in e && typeof e.code === 'number' ? e.code : null

const errorText = (e: unknown): string => (e instanceof Error ? e.message : typeof e === 'object' && e !== null && 'message' in e ? String(e.message) : String(e))

/**
 * Etherscan's list-check menu next to the token's badges. Of its items only "Add Token to MetaMask (Web3)" is
 * something this site can do (the rest are Etherscan account workflows). The wallet is first asked to switch to
 * this chain, so the token is not added under another network.
 */
export function TokenMenu({ token, symbol, decimals, chainId, chainName }: { token: string; symbol: string; decimals: number; chainId: number; chainName: string }) {
  const { open, setOpen, box } = useDropdown()
  const [status, setStatus] = useState<string | null>(null)

  async function addToWallet() {
    const eth = wallet()
    if (eth === null) {
      setStatus('No browser wallet found.')
      return
    }
    const want = `0x${chainId.toString(16)}`
    try {
      const current = await eth.request({ method: 'eth_chainId' })
      if (typeof current !== 'string' || current.toLowerCase() !== want) {
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: want }] })
      }
    } catch (e) {
      const code = errorCode(e)
      setStatus(code === 4902 ? `Add the ${chainName} network (chain ${chainId}) to your wallet first.` : code === 4001 ? 'Network switch rejected.' : `Wallet error: ${errorText(e)}`)
      return
    }
    try {
      const added = await eth.request({ method: 'wallet_watchAsset', params: { type: 'ERC20', options: { address: token, symbol: symbol.slice(0, 11), decimals } } })
      setStatus(added === true ? `${symbol} added to your wallet.` : 'The wallet did not add the token.')
    } catch (e) {
      setStatus(errorCode(e) === 4001 ? 'Request rejected.' : `Wallet error: ${errorText(e)}`)
    }
  }

  return (
    <div className="tk-dropdown" ref={box}>
      <button type="button" className="btn btn-sm btn-white tk-menu-btn" aria-haspopup="menu" aria-expanded={open} aria-label="More options" onClick={() => setOpen((o) => !o)}>
        <ListChecks size={14} />
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="tk-dropdown-menu tk-dropdown-end" role="menu">
          <button type="button" role="menuitem" className="tk-dropdown-item" onClick={() => void addToWallet()}>
            Add Token to MetaMask (Web3)
          </button>
          {status && <div className="tk-dropdown-status">{status}</div>}
        </div>
      )}
    </div>
  )
}

/** The magnifier at the right of the tab row: a GET form that reopens the token page as "?a=<what was typed>". */
export function TokenFilter({ action, placeholder, value }: { action: string; placeholder: string; value?: string }) {
  const { open, setOpen, box } = useDropdown()
  return (
    <div className="tk-dropdown" ref={box}>
      <button type="button" className="btn btn-sm tk-search-btn" aria-haspopup="dialog" aria-expanded={open} aria-label="Filter" onClick={() => setOpen((o) => !o)}>
        <Search size={14} />
      </button>
      {open && (
        <div className="tk-dropdown-menu tk-dropdown-end tk-filter-menu">
          <form action={action} method="get" className="d-flex gap-2">
            <input name="a" className="form-control form-control-sm" placeholder={placeholder} defaultValue={value} aria-label={placeholder} autoFocus required />
            <button type="submit" className="btn btn-sm btn-primary">
              Find
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

/** A grey notice box with a close button (Etherscan's dismissible `alert-dark`); closed, it stays closed until reload. */
export function Dismissible({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(true)
  if (!shown) return null
  return (
    <div className="tk-alert" role="status">
      <div className="tk-alert-text">{children}</div>
      <button type="button" className="tk-alert-close" aria-label="Close" onClick={() => setShown(false)}>
        <X size={16} />
      </button>
    </div>
  )
}

/**
 * The list/chart switch in a holder-analytics card header. Both views are rendered by the server; this only picks the
 * one shown.
 */
export function ViewSwitch({
  title,
  initial,
  chart,
  list,
  chartKind,
}: {
  title: string
  initial: 'list' | 'chart'
  chart: React.ReactNode
  list: React.ReactNode
  chartKind: 'pie' | 'bar'
}) {
  const [view, setView] = useState(initial)
  return (
    <div className="card tk-chart-card h-100">
      <div className="card-header tk-chart-head">
        <h6 className="fw-normal mb-0">{title}</h6>
        <div className="tk-segment" role="group" aria-label={`${title} view`}>
          <button type="button" className={`tk-segment-btn${view === 'list' ? ' active' : ''}`} aria-pressed={view === 'list'} title="List" onClick={() => setView('list')}>
            <List size={12} />
          </button>
          <button type="button" className={`tk-segment-btn${view === 'chart' ? ' active' : ''}`} aria-pressed={view === 'chart'} title="Chart" onClick={() => setView('chart')}>
            {chartKind === 'pie' ? <ChartPie size={12} /> : <ChartBarDecreasing size={12} />}
          </button>
        </div>
      </div>
      <div className="tk-chart-body" hidden={view !== 'list'}>
        {list}
      </div>
      <div className="tk-chart-body" hidden={view !== 'chart'}>
        {chart}
      </div>
    </div>
  )
}
