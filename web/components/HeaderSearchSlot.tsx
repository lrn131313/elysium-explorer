'use client'

import { usePathname } from 'next/navigation'
import { CompactSearch } from './SearchBox'

/** The topbar search, left out on the home page where the hero carries the big one (as on Etherscan). */
export function HeaderSearchSlot() {
  return usePathname() === '/' ? null : <CompactSearch />
}
