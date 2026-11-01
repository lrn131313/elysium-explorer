import { Binary, Download, FileDigit, Fuel, ReceiptText, RefreshCw, Send, type LucideIcon } from 'lucide-react'

/**
 * The header menu (TEAM.md §3 "Menu"), in Etherscan's order and wording. Every route is built by one of the teams;
 * the menu only links them. `note` is Etherscan's small grey suffix, e.g. "(ERC-20)".
 */
export interface MenuItem {
  label: string
  href: string
  note?: string
  icon?: LucideIcon
}

/** A titled column of the "More" mega menu. */
export interface MenuGroup {
  title: string
  items: MenuItem[]
}

export interface Menu {
  key: string
  label: string
  /** Plain list; 'sep' draws a divider. */
  items?: (MenuItem | 'sep')[]
  /** Mega menu columns (More). */
  groups?: MenuGroup[]
}

export const MENUS: Menu[] = [
  {
    key: 'blockchain',
    label: 'Blockchain',
    items: [
      { label: 'Transactions', href: '/txs' },
      { label: 'Latest L1→L2 Transactions', href: '/txsDeposits' },
      { label: 'Latest L2→L1 Transactions', href: '/txsExit' },
      { label: 'Contract Internal Transactions', href: '/txsInternal' },
      'sep',
      { label: 'View Blocks', href: '/blocks' },
      'sep',
      { label: 'Top Accounts', href: '/accounts' },
      { label: 'Verified Contracts', href: '/contractsVerified' },
    ],
  },
  {
    key: 'tokens',
    label: 'Tokens',
    items: [
      { label: 'Top Tokens', href: '/tokens', note: '(ERC-20)' },
      { label: 'Token Transfers', href: '/tokentxns', note: '(ERC-20)' },
    ],
  },
  {
    key: 'nfts',
    label: 'NFTs',
    items: [
      { label: 'Latest Transfers', href: '/nft-transfers' },
      { label: 'Latest Mints', href: '/nft-latest-mints' },
    ],
  },
  {
    key: 'resources',
    label: 'Resources',
    items: [{ label: 'Charts & Stats', href: '/charts' }],
  },
  {
    key: 'more',
    label: 'More',
    groups: [
      {
        title: 'Developer Tools',
        items: [
          { label: 'Input Data Decoder', href: '/inputdatadecoder', icon: FileDigit },
          { label: 'Unit Converter', href: '/unitconverter', icon: RefreshCw },
          { label: 'Download Data (CSV Export)', href: '/exportData', icon: Download },
          { label: 'Account Balance Checker', href: '/balancecheck-tool', icon: ReceiptText },
          { label: 'Broadcast Transaction', href: '/pushTx', icon: Send },
          { label: 'Bytecode to Opcode', href: '/opcode-tool', icon: Binary },
        ],
      },
      {
        title: 'Explore',
        items: [{ label: 'Gas Tracker', href: '/gastracker', icon: Fuel }],
      },
    ],
  },
]

/** Every entry of a menu, flat. */
export function menuItems(m: Menu): MenuItem[] {
  const list = m.items ? m.items.filter((it): it is MenuItem => it !== 'sep') : []
  const grouped = m.groups ? m.groups.flatMap((g) => g.items) : []
  return [...list, ...grouped]
}

/** A menu entry is "current" on its own page and the pages under it (e.g. /accounts/label/x under /accounts). */
export const isCurrent = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`)

/** Which top-level entry gets Etherscan's `.active` for this page: 'home', a menu key, or none. */
export function activeSection(pathname: string): string | null {
  if (pathname === '/') return 'home'
  const m = MENUS.find((menu) => menuItems(menu).some((it) => isCurrent(pathname, it.href)))
  return m ? m.key : null
}
