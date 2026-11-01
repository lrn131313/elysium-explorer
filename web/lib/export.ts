// Etherscan's "Download Data (CSV Export)": Blockscout's CSV files rewritten into Etherscan's column names and order.
// Etherscan columns this chain has no data for (USD value of a token transfer on its day, an internal call's parent
// transaction, a holder's pending balance update) are left out rather than filled with blanks. Server only.
import { methodLabel } from '@/components/ui'
import { api, csvExport, NotFoundError, type CsvSource } from './api'
import { parseCsv, type Sheet } from './csv'
import { COIN, formatUnits, listDate } from './format'
import { methodNames, shownMethod } from './methods'

/** The export kinds, keyed by the `type` in /exportData links. Address kinds take an address; token kinds a token contract. */
export const EXPORT_TYPES = {
  address: { label: 'Transactions', of: 'address' },
  internaltxns: { label: 'Internal Transactions', of: 'address' },
  addresstokentxns: { label: 'Token Transfers (ERC-20)', of: 'address' },
  tokentxns: { label: 'Token Transfers (ERC-20)', of: 'token' },
  tokenholders: { label: 'Token Holders (ERC-20)', of: 'token' },
} as const

export type ExportType = keyof typeof EXPORT_TYPES

export const isExportType = (v: string): v is ExportType => Object.hasOwn(EXPORT_TYPES, v)

/** What the form got wrong, as the `error` the export sends it back with. */
export type ExportError = 'type' | 'address' | 'dates' | 'limit' | 'token'

export const isExportError = (v: string): v is ExportError => ['type', 'address', 'dates', 'limit', 'token'].includes(v)

/** A whole UTC day written YYYY-MM-DD that exists in the calendar (2026-02-30 does not). */
export function isDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const ms = Date.parse(`${s}T00:00:00Z`)
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === s
}

/** The range holds more rows than Blockscout writes into one file, so the file would be incomplete. */
export class TooManyRecords extends Error {}

/** The contract given for a token export is not an ERC-20 token. */
export class NotAnErc20 extends Error {}

/** Blockscout's file as one record per row, holding the columns in `need` (checked present, every row full width). */
function records<K extends string>(table: string[][], need: readonly K[]): Record<K, string>[] {
  const [header, ...rows] = table
  if (header === undefined) throw new Error('Blockscout CSV export: empty file')
  const at = need.map((k) => {
    const i = header.indexOf(k)
    if (i < 0) throw new Error(`Blockscout CSV export: no ${k} column in ${header.join(',')}`)
    return { k, i }
  })
  return rows.map((r, n) => {
    if (r.length !== header.length) throw new Error(`Blockscout CSV export: row ${n + 1} has ${r.length} cells, the header ${header.length}`)
    const rec = {} as Record<K, string>
    for (const { k, i } of at) {
      const v = r[i]
      if (v === undefined) throw new Error(`Blockscout CSV export: row ${n + 1} has no cell ${i}`)
      rec[k] = v
    }
    return rec
  })
}

/** Blockscout writes "2026-10-31 18:51:26.000000Z"; Etherscan has the Unix seconds and "2026-10-31 18:51:26". */
function when(ts: string): [unix: string, utc: string] {
  const ms = Date.parse(`${ts.slice(0, 19).replace(' ', 'T')}Z`)
  if (Number.isNaN(ms)) throw new Error(`Blockscout CSV export: bad timestamp ${ts}`)
  return [String(ms / 1000), listDate(ms)]
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Coins from wei, exact, without thousands separators. */
const coins = (wei: string) => formatUnits(wei, 18, { grouped: false })

/**
 * US dollars for `wei` at `price` dollars per coin, to the cent; below a cent, two significant digits, so a typical fee
 * here (a fraction of a cent) does not read as zero. Float is fine: an estimate beside the exact amount.
 */
function dollars(wei: string, price: number): string {
  const v = (Number(BigInt(wei)) / 1e18) * price
  if (v === 0) return '0.00'
  return Math.abs(v) >= 0.01 ? v.toFixed(2) : v.toPrecision(2)
}

/** Oldest first, as Etherscan exports. Blockscout writes some files newest first and some oldest first. */
function oldestFirst<T extends { BlockNumber: string }>(rows: T[]): T[] {
  const first = rows[0]
  const last = rows.at(-1)
  const ordered = first !== undefined && last !== undefined && Number(first.BlockNumber) > Number(last.BlockNumber) ? [...rows].reverse() : [...rows]
  // Array.prototype.sort is stable, so rows of one block keep their order.
  return ordered.sort((a, b) => Number(a.BlockNumber) - Number(b.BlockNumber))
}

/** Blockscout's file, read into rows (header first); null for an address Blockscout has never seen. */
async function fetchTable(src: CsvSource): Promise<string[][] | null> {
  try {
    const { text, limit } = await csvExport(src)
    const table = parseCsv(text)
    if (table.length - 1 >= limit) throw new TooManyRecords(`${src.kind}: ${limit} rows or more`)
    return table
  } catch (e) {
    // Blockscout has no page for an address it has never seen; such an address simply has no records.
    if (e instanceof NotFoundError) return null
    throw e
  }
}

/** Current coin price in dollars, or null when Blockscout has none. */
async function coinPrice(): Promise<number | null> {
  const s = await api.stats()
  return s.coin_price === null ? null : Number(s.coin_price)
}

const currentValueHeader = (price: number | null) => (price === null ? 'CurrentValue' : `CurrentValue @ $${price}/${COIN}`)

async function transactions(address: string, from: string, to: string): Promise<Sheet> {
  const [table, price] = await Promise.all([fetchTable({ kind: 'transactions', address, from, to }), coinPrice()])
  const cols = ['TxHash', 'BlockNumber', 'UnixTimestamp', 'FromAddress', 'ToAddress', 'ContractAddress', 'Value', 'Fee', 'Status', 'ErrCode', 'TxDateClosingPrice', 'MethodName'] as const
  const rows = table === null ? [] : oldestFirst(records(table, cols))
  const names = await methodNames(rows.map((r) => (r.MethodName === '' ? null : r.MethodName)))
  return {
    name: `export-${address}.csv`,
    header: ['Transaction Hash', 'Blockno', 'UnixTimestamp', 'DateTime (UTC)', 'From', 'To', 'ContractAddress', `Value_IN(${COIN})`, `Value_OUT(${COIN})`, currentValueHeader(price), `TxnFee(${COIN})`, 'TxnFee(USD)', `Historical $Price/${COIN}`, 'Status', 'ErrCode', 'Method'],
    rows: rows.map((r) => {
      const into = same(r.ToAddress, address) || same(r.ContractAddress, address)
      const out = same(r.FromAddress, address)
      const dayPrice = r.TxDateClosingPrice === '' ? null : Number(r.TxDateClosingPrice)
      const method = shownMethod(r.MethodName === '' ? null : r.MethodName, names)
      return [
        r.TxHash,
        r.BlockNumber,
        ...when(r.UnixTimestamp),
        r.FromAddress,
        r.ToAddress,
        r.ContractAddress,
        into ? coins(r.Value) : '0',
        out ? coins(r.Value) : '0',
        price === null ? '' : dollars(r.Value, price),
        coins(r.Fee),
        dayPrice === null ? '' : dollars(r.Fee, dayPrice),
        dayPrice === null ? '' : dayPrice.toFixed(2),
        r.Status === 'ok' ? 'Success' : 'Failed',
        r.ErrCode,
        // A creation has no method; Etherscan shows its input's first bytes, which Blockscout's file does not carry.
        r.ContractAddress !== '' && r.ToAddress === '' ? '' : method === null ? 'Transfer' : methodLabel(method),
      ]
    }),
  }
}

/** Calls that move no value of their own; Etherscan's internal list leaves them out (see etherscanInternal in api.ts). */
const NO_OWN_VALUE = new Set(['delegatecall', 'staticcall'])

async function internal(address: string, from: string, to: string): Promise<Sheet> {
  const [table, price] = await Promise.all([fetchTable({ kind: 'internal-transactions', address, from, to }), coinPrice()])
  const cols = ['TxHash', 'Index', 'BlockNumber', 'TxIndex', 'UnixTimestamp', 'FromAddress', 'ToAddress', 'ContractAddress', 'Type', 'CallType', 'Value', 'ErrCode'] as const
  const all = table === null ? [] : records(table, cols)
  const rows = all
    .filter((r) => r.Type !== 'call' || (!NO_OWN_VALUE.has(r.CallType) && r.Value !== '0'))
    .sort((a, b) => Number(a.BlockNumber) - Number(b.BlockNumber) || Number(a.TxIndex) - Number(b.TxIndex) || Number(a.Index) - Number(b.Index))
  return {
    name: `export-internaltx-${address}.csv`,
    header: ['Transaction Hash', 'Blockno', 'UnixTimestamp', 'DateTime (UTC)', 'From', 'TxTo', 'ContractAddress', `Value_IN(${COIN})`, `Value_OUT(${COIN})`, currentValueHeader(price), 'Status', 'ErrCode', 'Type'],
    rows: rows.map((r) => {
      const into = same(r.ToAddress, address) || same(r.ContractAddress, address)
      const out = same(r.FromAddress, address)
      return [
        r.TxHash,
        r.BlockNumber,
        ...when(r.UnixTimestamp),
        r.FromAddress,
        r.ToAddress,
        r.ContractAddress,
        into ? coins(r.Value) : '0',
        out ? coins(r.Value) : '0',
        price === null ? '' : dollars(r.Value, price),
        r.ErrCode === '' ? 'Success' : 'Failed',
        r.ErrCode,
        r.Type === 'call' ? r.CallType : r.Type,
      ]
    }),
  }
}

type TokenFacts = { erc20: boolean; name: string; symbol: string; decimals: number }

/** Type, name, symbol and decimals of each token, fetched once per token, ten at a time. */
async function tokenFacts(addresses: string[]): Promise<Map<string, TokenFacts>> {
  const out = new Map<string, TokenFacts>()
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))]
  for (let i = 0; i < unique.length; i += 10) {
    const batch = unique.slice(i, i + 10)
    const infos = await Promise.all(batch.map((a) => api.token(a)))
    for (const [j, t] of infos.entries()) {
      const key = batch[j]
      if (key === undefined) throw new Error('token batch out of step')
      out.set(key, {
        erc20: t.type === 'ERC-20',
        name: t.name === null ? '' : t.name,
        symbol: t.symbol === null ? '' : t.symbol,
        // An ERC-20 contract need not implement decimals(); wallets and Etherscan then count its raw units.
        decimals: t.decimals === null ? 0 : Number(t.decimals),
      })
    }
  }
  return out
}

/** ERC-20 transfers of an address, or of one token contract. */
type TransfersSource =
  | { kind: 'token-transfers'; address: string; from: string; to: string }
  | { kind: 'token-transfers-of-token'; token: string; from: string; to: string }

async function tokenTransfers(src: TransfersSource, fileName: string): Promise<Sheet> {
  const table = await fetchTable(src)
  const cols = ['TxHash', 'BlockNumber', 'UnixTimestamp', 'FromAddress', 'ToAddress', 'TokenContractAddress', 'TokensTransferred'] as const
  const all = table === null ? [] : oldestFirst(records(table, cols))
  const facts = await tokenFacts(all.map((r) => r.TokenContractAddress))
  const fact = (token: string) => {
    const f = facts.get(token.toLowerCase())
    if (f === undefined) throw new Error(`no token facts for ${token}`)
    return f
  }
  const rows = all.filter((r) => fact(r.TokenContractAddress).erc20)
  return {
    name: fileName,
    header: ['Transaction Hash', 'Blockno', 'UnixTimestamp', 'DateTime (UTC)', 'From', 'To', 'TokenValue', 'ContractAddress', 'TokenName', 'TokenSymbol'],
    rows: rows.map((r) => {
      const f = fact(r.TokenContractAddress)
      return [
        r.TxHash,
        r.BlockNumber,
        ...when(r.UnixTimestamp),
        r.FromAddress,
        r.ToAddress,
        formatUnits(r.TokensTransferred, f.decimals, { grouped: false }),
        r.TokenContractAddress,
        f.name,
        f.symbol,
      ]
    }),
  }
}

async function holders(token: string): Promise<Sheet> {
  const table = await fetchTable({ kind: 'holders', token })
  const rows = table === null ? [] : records(table, ['HolderAddress', 'Balance'] as const)
  return {
    name: `export-tokenholders-for-contract-${token}.csv`,
    header: ['HolderAddress', 'Balance'],
    rows: rows.map((r) => [r.HolderAddress, r.Balance]),
  }
}

/**
 * The whole export for one request. `target` is an address (address kinds) or a token contract (token kinds), already
 * checked to be well formed; `from`/`to` are YYYY-MM-DD and ignored for holders. Token kinds need an ERC-20 contract.
 */
export async function buildExport(type: ExportType, target: string, from: string, to: string): Promise<Sheet> {
  if (EXPORT_TYPES[type].of === 'token') {
    const t = await api.token(target).catch((e: unknown) => {
      // Blockscout answers 404 for an address that is no token at all.
      if (e instanceof NotFoundError) throw new NotAnErc20(`${target} is not a token`)
      throw e
    })
    if (t.type !== 'ERC-20') throw new NotAnErc20(`${target} is ${t.type}`)
  }
  switch (type) {
    case 'address':
      return transactions(target, from, to)
    case 'internaltxns':
      return internal(target, from, to)
    case 'addresstokentxns':
      return tokenTransfers({ kind: 'token-transfers', address: target, from, to }, `export-tokentxns-${target}.csv`)
    case 'tokentxns':
      return tokenTransfers({ kind: 'token-transfers-of-token', token: target, from, to }, `export-tokentxns-for-contract-${target}.csv`)
    case 'tokenholders':
      return holders(target)
  }
}
