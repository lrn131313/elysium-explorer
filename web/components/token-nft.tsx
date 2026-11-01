import { CircleHelp, Eye } from 'lucide-react'
import Link from 'next/link'
import type { Sheet } from '@/lib/csv'
import { listDate } from '@/lib/format'
import { getLabels } from '@/lib/labels'
import { methodNames, shownMethod } from '@/lib/methods'
import type { FilteredTransfer, NftInstance } from '@/lib/token-api'
import type { AddressParam, TokenInfo, TokenTransfer } from '@/lib/types'
import { AddressLink, displayName } from './AddressLink'
import { CopyButton } from './client'
import { AgeCell, AgeHead } from './tables'
import { EmptyRow, FlowArrow, InOut, Method, methodLabel } from './ui'

/** Where an NFT's picture is served from: our own route, which decodes on-chain images and has a placeholder. */
export const tokenImageSrc = (contract: string, id: string) => `/token/${contract}/image/${encodeURIComponent(id)}`

/** The page for one NFT: the collection's token page filtered by that token id (its owner and transfer history). */
export const itemHref = (contract: string, id: string) => `/token/${contract}?a=${encodeURIComponent(id)}`

/** The NFT's own name from its metadata, when it has a usable one. */
export function metadataName(metadata: unknown): string | null {
  if (typeof metadata !== 'object' || metadata === null || !('name' in metadata)) return null
  const name = metadata.name
  return typeof name === 'string' && name.trim() !== '' ? name.trim() : null
}

/** The name inside a transfer's `token_instance` (Blockscout's NFT instance object), when there is one. */
function instanceName(instance: unknown): string | null {
  if (typeof instance !== 'object' || instance === null || !('metadata' in instance)) return null
  return metadataName(instance.metadata)
}

/** One NFT transfer, whichever Blockscout list it came from. */
export interface NftRow {
  key: string
  hash: string
  method: string | null
  block: number
  timestamp: string | null
  from: AddressParam
  to: AddressParam
  token: TokenInfo
  tokenId: string | null
  /** ERC-1155 quantity (raw); null for ERC-721. */
  quantity: string | null
  name: string | null
  type: string
}

export function rowsFromTransfers(items: TokenTransfer[]): NftRow[] {
  return items.map((t) => {
    const total = t.total
    const tokenId = total !== null && 'token_id' in total ? total.token_id : null
    const quantity = total !== null && 'token_id' in total && 'value' in total ? total.value : null
    return {
      key: `${t.transaction_hash}-${t.log_index}`,
      hash: t.transaction_hash,
      method: t.method,
      block: t.block_number,
      timestamp: t.timestamp,
      from: t.from,
      to: t.to,
      token: t.token,
      tokenId,
      quantity,
      name: total !== null && 'token_instance' in total ? instanceName(total.token_instance) : null,
      type: t.token_type,
    }
  })
}

/** The advanced filter's rows for an NFT-only query: each has its token and recipient. */
export type NftMint = FilteredTransfer & { token: TokenInfo; to: AddressParam }

export function rowsFromMints(items: NftMint[]): NftRow[] {
  return items.map((m) => {
    const total = m.total
    return {
      key: `${m.hash}-${m.token_transfer_index}`,
      hash: m.hash,
      method: m.method,
      block: m.block_number,
      timestamp: m.timestamp,
      from: m.from,
      to: m.to,
      token: m.token,
      tokenId: total !== null && 'token_id' in total ? total.token_id : null,
      quantity: total !== null && 'token_id' in total && 'value' in total ? total.value : null,
      name: total !== null && 'token_instance' in total ? instanceName(total.token_instance) : null,
      type: m.type,
    }
  })
}

/** "Download Page Data" for an NFT list: the rows on screen as plain cells. */
export async function nftSheet(rows: NftRow[], kind: string, page: number): Promise<Sheet> {
  const [names, labels] = await Promise.all([methodNames(rows.map((r) => r.method)), getLabels()])
  const tag = (a: AddressParam) => {
    const name = displayName(a, labels)
    return name === null ? '' : name
  }
  return {
    name: `export-${kind}-page${page}.csv`,
    header: ['Transaction Hash', 'Method', 'Blockno', 'DateTime (UTC)', 'From', 'From_Nametag', 'To', 'To_Nametag', 'Type', 'Token ID', 'Quantity', 'Item Name', 'Token', 'Token Symbol', 'Token Contract'],
    rows: rows.map((r) => {
      const method = shownMethod(r.method, names)
      return [
        r.hash,
        method === null ? 'Transfer' : methodLabel(method),
        String(r.block),
        r.timestamp === null ? '' : listDate(r.timestamp),
        r.from.hash,
        tag(r.from),
        r.to.hash,
        tag(r.to),
        r.type,
        r.tokenId === null ? '' : r.tokenId,
        r.quantity === null ? (r.type === 'ERC-721' ? '1' : '') : r.quantity,
        r.name === null ? '' : r.name,
        r.token.name === null ? '' : r.token.name,
        r.token.symbol === null ? '' : r.token.symbol,
        r.token.address_hash,
      ]
    }),
  }
}

const PREVIEW_TIP = 'See preview of the transaction details.'
const ACTION_TIP = 'Function executed based on decoded input data. For unidentified functions, method ID is displayed instead.'

function Help({ tip }: { tip: string }) {
  return (
    <span title={tip} className="ex-help">
      <CircleHelp size={13} />
    </span>
  )
}

/** "ERC-721" / "ERC-1155" pill; an ERC-1155 transfer adds its quantity ("x5", capped at ">99"). */
export function NftType({ type, quantity }: { type: string; quantity: string | null }) {
  const q = quantity === null ? null : BigInt(quantity) > 99n ? '>99' : `x${quantity}`
  return (
    <span className="d-inline-flex align-items-center gap-1">
      <span className="tk-type-badge">{type}</span>
      {q !== null && type !== 'ERC-721' && (
        <span className="tk-type-badge" title={quantity ?? undefined}>
          {q}
        </span>
      )}
    </span>
  )
}

/** The Item cell: a 40px picture, the NFT's name (or "#id") and, when asked, the collection under it. */
export function NftItem({ token, id, name, collection }: { token: TokenInfo; id: string | null; name: string | null; collection: boolean }) {
  if (id === null) return <>-</>
  const title = name ?? `#${id}`
  return (
    <Link href={itemHref(token.address_hash, id)} className="tk-item link-dark" title={`${title}${collection ? `\n${token.name ?? token.address_hash}` : ''}`}>
      <img src={tokenImageSrc(token.address_hash, id)} alt="" width={40} height={40} className="tk-nft-img" loading="lazy" decoding="async" />
      <span className="tk-item-text">
        <span className="tk-item-name">{name ?? `#${id}`}</span>
        {name !== null && !name.includes(`#${id}`) && <span className="tk-item-sub">#{id}</span>}
        {collection && <span className="tk-item-sub">{token.name ?? token.address_hash}</span>}
      </span>
    </Link>
  )
}

function TxHashCell({ hash }: { hash: string }) {
  return (
    <span className="d-inline-flex align-items-center gap-1">
      <Link href={`/tx/${hash}`} className="ex-hash">
        {hash}
      </Link>
      <CopyButton text={hash} label="Copy Transaction Hash" />
    </span>
  )
}

/**
 * NFT transfers in Etherscan's three layouts:
 * - 'token' (an NFT collection's own Transfers tab): …, From, →, To, Item; counterparties open the collection
 *   filtered by them, and `me` (the "?a=" holder) turns the arrow into IN/OUT.
 * - 'feed' (/nft-transfers): …, From, →, To, Type, Item.
 * - 'mints' (/nft-latest-mints): eye, Transaction Hash, Block, Age, Maker, Type, Item.
 */
export async function NftTransferTable({ rows, variant, me }: { rows: NftRow[]; variant: 'token' | 'feed' | 'mints'; me?: string }) {
  const names = await methodNames(rows.map((r) => r.method))
  const mints = variant === 'mints'
  const cols = mints ? 7 : variant === 'feed' ? 10 : 9
  const party = (a: AddressParam, r: NftRow) => (variant === 'token' ? `/token/${r.token.address_hash}?a=${a.hash}` : undefined)
  return (
    <div className="ex-table-wrap">
      <table className="ex-table tk-table">
        <thead>
          <tr>
            <th className="ex-th-icon">
              <Help tip={PREVIEW_TIP} />
            </th>
            <th>Transaction Hash</th>
            {!mints && (
              <th className="ex-th-link">
                Action <Help tip={ACTION_TIP} />
              </th>
            )}
            <th>Block</th>
            <AgeHead />
            {mints ? (
              <th>Maker</th>
            ) : (
              <>
                <th>From</th>
                <th className="ex-th-badge" />
                <th>To</th>
              </>
            )}
            {variant !== 'token' && <th>Type</th>}
            <th>Item</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow cols={cols} />}
          {rows.map((r) => (
            <tr key={r.key}>
              <td>
                <Link href={`/tx/${r.hash}`} className="ex-eye" aria-label="View transaction" title={PREVIEW_TIP}>
                  <Eye size={12} />
                </Link>
              </td>
              <td>
                <TxHashCell hash={r.hash} />
              </td>
              {!mints && (
                <td>
                  <Method name={shownMethod(r.method, names)} />
                </td>
              )}
              <td>
                <Link href={`/block/${r.block}`}>{r.block}</Link>
              </td>
              <td className="text-nowrap">{r.timestamp && <AgeCell ts={r.timestamp} />}</td>
              {mints ? (
                <td>
                  <AddressLink a={r.to} copy />
                </td>
              ) : (
                <>
                  <td>
                    <AddressLink a={r.from} current={me} copy href={party(r.from, r)} />
                  </td>
                  <td className="text-center">{me ? <InOut from={r.from.hash} to={r.to.hash} me={me} /> : <FlowArrow />}</td>
                  <td>
                    <AddressLink a={r.to} current={me} copy href={party(r.to, r)} />
                  </td>
                </>
              )}
              {variant !== 'token' && (
                <td>
                  <NftType type={r.type} quantity={r.quantity} />
                </td>
              )}
              <td>
                <NftItem token={r.token} id={r.tokenId} name={r.name} collection={variant !== 'token'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The Inventory tab: a grid of the collection's NFTs (picture, id or name, owner), highest id first. */
export function InventoryGrid({ t, items }: { t: TokenInfo; items: NftInstance[] }) {
  return (
    <div className="tk-inventory">
      {items.map((it) => {
        const name = metadataName(it.metadata)
        return (
          <div key={it.id} className="tk-inv-card">
            <Link href={itemHref(t.address_hash, it.id)} className="tk-inv-img" title={name ?? `#${it.id}`}>
              <img src={tokenImageSrc(t.address_hash, it.id)} alt={name ?? `#${it.id}`} loading="lazy" decoding="async" />
            </Link>
            <div className="tk-inv-body">
              <Link href={itemHref(t.address_hash, it.id)} className="tk-inv-id text-truncate" title={it.id}>
                {name ?? `#${it.id}`}
              </Link>
              {name !== null && !name.includes(`#${it.id}`) && <div className="tk-item-sub text-truncate">#{it.id}</div>}
              <div className="tk-inv-owner">
                <span className="text-muted">Owner: </span>
                {it.owner === null ? '-' : <AddressLink a={it.owner} head={8} tail={6} href={`/token/${t.address_hash}?a=${it.owner.hash}`} />}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
