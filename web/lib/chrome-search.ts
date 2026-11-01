// Search box vocabulary, shared by the client search boxes and the server search route and results page.
//
// Etherscan's filters are All Filters / Addresses / Tokens / Name Tags / Domain Names / Labels / Websites. Only the
// ones this explorer can really answer are offered: Domain Names would be Ethereum ENS names (not Elysium addresses),
// and there is no website or label-cloud data. "Name Tags" searches our own name tags (lib/labels.ts).

/** The filters offered, in menu order, with the label each one shows. */
export const FILTER_LABEL = { all: 'All Filters', address: 'Addresses', token: 'Tokens', nametag: 'Name Tags' } as const

export type SearchFilter = keyof typeof FILTER_LABEL

export const SEARCH_FILTERS: readonly SearchFilter[] = ['all', 'address', 'token', 'nametag']

export const SEARCH_PLACEHOLDER = 'Search by Address / Txn Hash / Block / Token'

/** The filter named in a query string; anything else (missing, misspelt) is "All Filters". */
export function parseFilter(raw: string | undefined): SearchFilter {
  return SEARCH_FILTERS.find((f) => f === raw) ?? 'all'
}

/** Blockscout search result types that are an account (as opposed to a token, block or transaction). */
export const ADDRESS_TYPES: ReadonlySet<string> = new Set(['address', 'contract', 'label'])

/** Human names for Blockscout's search result types. */
export const TYPE_LABELS: Readonly<Record<string, string>> = {
  address: 'Address',
  contract: 'Contract',
  label: 'Label',
  token: 'Token',
  transaction: 'Transaction',
  block: 'Block',
  ens_domain: 'ENS name (Ethereum)',
}
