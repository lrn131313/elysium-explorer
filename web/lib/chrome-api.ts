// Data for the chrome (topbar, home page). Server only: built on lib/api.ts, which reads server env vars.
import { get, rpcBatch } from './api'
import { formatUnits } from './format'

/** The fee a transaction pays now on our node: the next block's base fee and the suggested priority fee, in wei. */
export interface GasFees {
  base: bigint
  priority: bigint
}

const isHex = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]+$/.test(v)

/**
 * Base fee from eth_feeHistory (its last entry is the base fee of the next block, the one a transaction sent now pays)
 * and the node's eth_maxPriorityFeePerGas. Etherscan's topbar "Gas:" is their sum, with both in the tooltip.
 */
export async function gasFees(): Promise<GasFees> {
  const [history, tip] = await rpcBatch(
    [
      { method: 'eth_feeHistory', params: [1, 'latest', []] },
      { method: 'eth_maxPriorityFeePerGas', params: [] },
    ],
    5_000,
  )
  if (!history || 'error' in history) throw new Error(`eth_feeHistory: ${history ? history.error : 'no reply'}`)
  if (!tip || 'error' in tip) throw new Error(`eth_maxPriorityFeePerGas: ${tip ? tip.error : 'no reply'}`)
  const r = history.result
  const fees = typeof r === 'object' && r !== null && 'baseFeePerGas' in r ? r.baseFeePerGas : undefined
  const next = Array.isArray(fees) ? fees[fees.length - 1] : undefined
  if (!isHex(next)) throw new Error(`eth_feeHistory: unexpected baseFeePerGas ${JSON.stringify(fees)}`)
  if (!isHex(tip.result)) throw new Error(`eth_maxPriorityFeePerGas: unexpected reply ${JSON.stringify(tip.result)}`)
  return { base: BigInt(next), priority: BigInt(tip.result) }
}

export const gweiText = (wei: bigint) => `${formatUnits(wei, 9)} Gwei`

/** Etherscan's gas tooltip, one fee per line: "Base Fee: 0.1 Gwei" / "Priority Fee: 0 Gwei". */
export const gasTitle = (g: GasFees) => `Base Fee: ${gweiText(g.base)}\nPriority Fee: ${gweiText(g.priority)}`

/** Blockscout's rolling 24-hour transaction figures. */
export interface TxStats24h {
  transactions_count_24h: string
  transaction_fees_sum_24h: string
  transaction_fees_avg_24h: string
}

export const txStats24h = () => get<TxStats24h>('/transactions/stats')
