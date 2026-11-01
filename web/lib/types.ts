// Subset of the Blockscout API v2 response shapes this UI reads (v12.0.3, CHAIN_TYPE=arbitrum).
// Wei and other uint256 amounts arrive as decimal strings; keep them as strings and convert with BigInt.

export type Hex = `0x${string}`

export interface AddressParam {
  hash: string
  name: string | null
  is_contract: boolean
  is_verified: boolean | null
  ens_domain_name: string | null
  public_tags: { label: string; display_name: string }[] | null
  implementations: { address_hash: string; name: string | null }[] | null
  proxy_type: string | null
}

export interface Block {
  height: number
  hash: string
  parent_hash: string
  timestamp: string
  miner: AddressParam
  transactions_count: number
  internal_transactions_count: number | null
  gas_used: string
  gas_limit: string
  gas_used_percentage: number | null
  base_fee_per_gas: string | null
  burnt_fees: string | null
  priority_fee: string | null
  transaction_fees: string | null
  size: number
  nonce: string
  // CHAIN_TYPE=arbitrum extras (absent when the batch tracker is off)
  arbitrum?: ArbitrumBlockInfo | null
}

export interface ArbitrumBlockInfo {
  batch_number: number | null
  l1_block_height: number | null
  send_count: number | null
  send_root: string | null
  status: string | null
}

export interface DecodedInput {
  method_call: string
  method_id: string // the 4-byte selector as bare hex, without 0x (e.g. "095ea7b3")
  parameters: { name: string; type: string; value: unknown }[]
}

export interface TokenInfo {
  address_hash: string
  name: string | null
  symbol: string | null
  decimals: string | null
  type: string
  icon_url: string | null
  holders_count: string | null
  total_supply: string | null
  exchange_rate: string | null
  circulating_market_cap: string | null
}

// A transfer's amount, in the shape Blockscout picks per token type (token_transfer_view.ex
// prepare_token_transfer_total): ERC-721 has no amount at all, ERC-1155/404 has an id and an amount,
// fungible tokens have only an amount. Null when Blockscout cannot work it out.
export type TransferTotal =
  | { token_id: string | null; token_instance: unknown }
  | { token_id: string | null; value: string | null; decimals: string | null; token_instance: unknown }
  | { value: string | null; decimals: string | null }

export interface TokenTransfer {
  transaction_hash: string
  block_number: number
  timestamp: string | null
  from: AddressParam
  to: AddressParam
  token: TokenInfo
  token_type: string
  total: TransferTotal | null
  type: string
  method: string | null
  log_index: number
}

export interface Transaction {
  hash: string
  block_number: number | null
  timestamp: string | null
  confirmations: number
  status: 'ok' | 'error' | null
  result: string
  revert_reason: { raw?: string; method_call?: string } | string | null
  from: AddressParam
  to: AddressParam | null
  created_contract: AddressParam | null
  value: string
  fee: { type: string; value: string | null }
  gas_price: string | null
  gas_used: string | null
  gas_limit: string
  base_fee_per_gas: string | null
  max_fee_per_gas: string | null
  max_priority_fee_per_gas: string | null
  transaction_burnt_fee: string | null
  nonce: number
  position: number | null
  type: number | null
  method: string | null
  decoded_input: DecodedInput | null
  raw_input: string
  token_transfers: TokenTransfer[] | null
  token_transfers_overflow: boolean | null
  transaction_types: string[]
  exchange_rate: string | null
  historic_exchange_rate: string | null
  confirmation_duration: [number, number] | null
  // CHAIN_TYPE=arbitrum extras
  arbitrum?: ArbitrumTxInfo | null
}

export interface ArbitrumTxInfo {
  status: string | null
  batch_number: number | null
  contains_message: 'incoming' | 'outcoming' | null
  gas_used_for_l1: string | null
  gas_used_for_l2: string | null
  poster_fee: string | null
  network_fee: string | null
  message_related_info: { message_status: string | null; associated_l1_transaction_hash: string | null } | null
}

export interface InternalTransaction {
  transaction_hash: string
  block_number: number
  transaction_index: number
  timestamp: string
  index: number
  type: string
  from: AddressParam
  to: AddressParam | null
  created_contract: AddressParam | null
  value: string
  success: boolean
  error: string | null
  gas_limit: string
}

export interface Log {
  index: number
  address: AddressParam
  topics: (string | null)[]
  data: string
  decoded: { method_call: string; method_id: string; parameters: { name: string; type: string; value: unknown; indexed: boolean }[] } | null
}

export interface AddressInfo {
  hash: string
  name: string | null
  is_contract: boolean
  is_verified: boolean | null
  coin_balance: string | null
  exchange_rate: string | null
  creator_address_hash: string | null
  creation_transaction_hash: string | null
  token: TokenInfo | null
  ens_domain_name: string | null
  implementations: { address_hash: string; name: string | null }[] | null
  proxy_type: string | null
  has_tokens: boolean
  has_token_transfers: boolean
  public_tags: { label: string; display_name: string }[] | null
}

export interface AddressCounters {
  transactions_count: string
  token_transfers_count: string
  gas_usage_count: string
  validations_count: string
}

export interface TokenBalance {
  token: TokenInfo
  token_id: string | null
  value: string
}

export interface Stats {
  average_block_time: number
  coin_price: string | null
  coin_price_change_percentage: number | null
  market_cap: string | null
  gas_prices: { slow: number | null; average: number | null; fast: number | null } | null
  total_addresses: string
  total_blocks: string
  total_transactions: string
  transactions_today: string | null
}

export interface ChartPoint {
  date: string
  transactions_count: number
}

export type PageParams = Record<string, string | number | boolean | null>

export interface Page<T> {
  items: T[]
  next_page_params: PageParams | null
}

export interface AbiParam {
  name: string
  type: string
  internalType?: string
  components?: AbiParam[]
}

export interface SmartContract {
  name: string | null
  language: string | null
  compiler_version: string | null
  compiler_settings: Record<string, unknown> | null
  optimization_enabled: boolean | null
  optimization_runs: number | null
  evm_version: string | null
  license_type: string | null
  source_code: string | null
  file_path: string | null
  additional_sources: { file_path: string; source_code: string }[] | null
  abi: unknown[] | null
  is_verified: boolean | null
  // Exact match vs a match that differs only in the metadata hash appended to the bytecode.
  is_fully_verified: boolean | null
  is_partially_verified: boolean | null
  deployed_bytecode: string | null
  creation_bytecode: string | null
  constructor_args: string | null
  // [value, the constructor input it belongs to]; values are strings, numbers, booleans or nested arrays.
  decoded_constructor_args: [unknown, AbiParam][] | null
}

export interface SearchRedirect {
  redirect: boolean
  type: 'address' | 'block' | 'transaction' | 'user_operation' | 'blob' | null
  parameter: string | null
}

export interface SearchItem {
  type: string
  name?: string | null
  symbol?: string | null
  address_hash?: string
  transaction_hash?: string
  block_number?: number
  block_hash?: string
}
