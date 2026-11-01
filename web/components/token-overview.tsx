import { CircleHelp, Coins, FileText, Hash, Info, Receipt, Wallet } from 'lucide-react'
import Link from 'next/link'
import { formatUnits, num, usd } from '@/lib/format'
import { SITE } from '@/lib/site'
import { percentText, unitParts } from '@/lib/token-format'
import { isServableImage } from '@/lib/token-image'
import type { AddressParam, TokenInfo } from '@/lib/types'
import { displayName } from './AddressLink'
import { CopyButton } from './client'
import { getLabels } from '@/lib/labels'
import { TokenMenu } from './token-client'
import { tokenImageSrc } from './token-nft'

export const isNft = (t: Pick<TokenInfo, 'type'>) => t.type === 'ERC-721' || t.type === 'ERC-1155' || t.type === 'ERC-404'

const SOURCE_TIP =
  'The contract’s source code has been verified to match its on-chain creation and runtime bytecode. Source code verification does not imply the contract is safe to interact with.'
const ONCHAIN_CAP_TIP = `Calculated by multiplying the token's Total Supply on ${SITE.chainName} with the current market price per token. Numbers may be unrealistic if the onchain supply is much larger than the reported circulating supply.`

/**
 * "Token  Name (SYM)" with the token's 32px round avatar, over the page's bottom border. The icon comes from our own
 * route and only when it is an on-chain `data:` image; any other `icon_url` (an off-chain URL) gets the coins
 * placeholder, so the visitor's browser never fetches from a host the token's metadata names.
 */
export function TokenHead({ t }: { t: TokenInfo }) {
  return (
    <div className="tk-head">
      {isServableImage(t.icon_url) ? (
        <img src={`/token/${t.address_hash}/icon`} alt="" width={32} height={32} className="tk-avatar" />
      ) : (
        <span className="tk-avatar" aria-hidden="true">
          <Coins size={17} />
        </span>
      )}
      <h1 className="ex-page-title">Token</h1>
      <span className="tk-name">
        {t.name ?? 'Unnamed'}
        {t.symbol && <span className="text-muted"> ({t.symbol})</span>}
      </span>
    </div>
  )
}

/** The badges row above the cards: token standard, "Source Code" when verified; the list menu on the right. */
export function TokenProfile({ t, verified }: { t: TokenInfo; verified: boolean }) {
  return (
    <div className="tk-profile">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className="tk-pill">{t.type}</span>
        {verified && (
          <span className="tk-pill tk-pill-success" title={SOURCE_TIP}>
            Source Code
          </span>
        )}
      </div>
      {t.type === 'ERC-20' && t.symbol && (
        <TokenMenu token={t.address_hash} symbol={t.symbol} decimals={Number(t.decimals ?? '0')} chainId={SITE.chainId} chainName={SITE.chainName} />
      )}
    </div>
  )
}

function Field({ label, help, children }: { label: React.ReactNode; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="ex-cap mb-1">
        {label}
        {help && (
          <span title={help} className="tk-help ms-1">
            <CircleHelp size={12} />
          </span>
        )}
      </h3>
      <div>{children}</div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="col-md-6 col-lg-4">
      <div className="card h-100">
        <div className="card-body tk-card-body">
          <h2 className="tk-card-title">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  )
}

/** The supply in full precision, the decimal point in bold as Etherscan prints it. */
function Supply({ t }: { t: TokenInfo }) {
  if (t.total_supply === null) return <>-</>
  const p = unitParts(t.total_supply, Number(t.decimals ?? '0'))
  return (
    <>
      {p.int}
      {p.frac !== null && (
        <>
          <b>.</b>
          {p.frac}
        </>
      )}
      {t.symbol && ` ${t.symbol}`}
    </>
  )
}

/**
 * The three cards under the badges: Overview, Market, Other Info. Blockscout has no price for any token on this chain,
 * so the Market fields read "-" unless it ever reports one.
 */
export function TokenCards({ t, holders, transfers }: { t: TokenInfo; holders: number; transfers: number }) {
  const dec = Number(t.decimals ?? '0')
  const rate = t.exchange_rate === null ? null : Number(t.exchange_rate)
  const onchainCap = rate !== null && t.total_supply !== null ? usd((Number(BigInt(t.total_supply)) / 10 ** dec) * rate) : '-'
  const nft = isNft(t)
  return (
    <div className="row g-3 mb-4">
      <Card title="Overview">
        <Field label="Max Total Supply">
          <Supply t={t} />
        </Field>
        <Field label="Holders">{num(holders)}</Field>
        <Field label="Total Transfers">
          <span className="d-inline-flex align-items-center gap-1">
            {num(transfers)}
            <span className="tk-help" title={`Every transfer of this token recorded on ${SITE.chainName}, mints and burns included.`}>
              <Info size={13} />
            </span>
          </span>
        </Field>
      </Card>
      <Card title="Market">
        {nft ? (
          <>
            <Field label="Volume (24H)">-</Field>
            <Field label="Min Price (24H)">-</Field>
            <Field label="Max Price (24H)">-</Field>
          </>
        ) : (
          <>
            <Field label="Price">{rate === null ? '-' : usd(rate)}</Field>
            <Field label="Onchain Market Cap" help={ONCHAIN_CAP_TIP}>
              {onchainCap}
            </Field>
            <Field label="Circulating Supply Market Cap">{t.circulating_market_cap === null ? '-' : usd(Number(t.circulating_market_cap))}</Field>
          </>
        )}
      </Card>
      <Card title="Other Info">
        <Field
          label={
            nft ? (
              'Token Contract'
            ) : (
              <>
                Token Contract (With <b>{dec}</b> Decimals)
              </>
            )
          }
        >
          <span className="d-flex align-items-center gap-1 tk-min0">
            <span className="ex-contract-icon" title="Contract">
              <FileText size={14} aria-label="Contract" />
            </span>
            <Link href={`/address/${t.address_hash}`} className="text-truncate">
              {t.address_hash}
            </Link>
            <CopyButton text={t.address_hash} label="Copy Address" />
          </span>
        </Field>
      </Card>
    </div>
  )
}

function FilterCol({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="col-md tk-filter-col">
      <h4 className="tk-filter-cap">{label}</h4>
      <div>{children}</div>
    </div>
  )
}

/**
 * Etherscan's "Filtered by Token Holder" card above the holder's transfers: the address, its balance of this token
 * and its value (no price on this chain, so "-", followed by the share of the total supply).
 */
export async function HolderCard({ t, holder, known, balance }: { t: TokenInfo; holder: string; known: AddressParam | null; balance: bigint | null }) {
  const dec = Number(t.decimals ?? '0')
  const hash = known === null ? holder : known.hash
  const name = known === null ? null : displayName(known, await getLabels())
  const supply = t.total_supply === null ? null : BigInt(t.total_supply)
  const share = balance !== null && supply !== null ? percentText(balance, supply, 4) : null
  return (
    <div className="card mb-1 tk-filter-card">
      <div className="card-body">
        <div className="row g-3">
          <div className="col-md-4 col-lg tk-filter-main">
            <h4 className="tk-filter-title">
              <Wallet size={14} className="tk-filter-icon" /> Filtered by Token Holder
            </h4>
            <div className="d-flex align-items-center gap-1 tk-min0">
              <Link href={`/address/${hash}`} className="fw-bold text-truncate" title="View Address Page">
                {hash}
              </Link>
              <CopyButton text={hash} label="Copy Address" />
            </div>
            {name && <span className="ex-badge mt-1">{name}</span>}
          </div>
          <FilterCol label="Balance">
            {balance === null ? (
              <span title="The token contract did not answer the standard balanceOf call.">-</span>
            ) : (
              <>
                {formatUnits(balance, dec)}
                {t.symbol && ` ${t.symbol}`}
              </>
            )}
          </FilterCol>
          <FilterCol label="Value">
            <span title="No price source is known for this token">-</span>
            {share !== null && (
              <span className="text-muted" title="Percentage of the Total Supply">
                {' '}
                [{share}%]
              </span>
            )}
          </FilterCol>
        </div>
      </div>
    </div>
  )
}

/** The card above one NFT's transfers ("?a=<token id>"): its image, id and name, owner and transfer count. */
export function TokenIdCard({
  t,
  id,
  name,
  owner,
  transfers,
}: {
  t: TokenInfo
  id: string
  name: string | null
  owner: AddressParam | null
  transfers: number
}) {
  return (
    <div className="card mb-1 tk-filter-card">
      <div className="card-body">
        <div className="row g-3 align-items-center">
          <div className="col-auto">
            <img src={tokenImageSrc(t.address_hash, id)} alt={name ?? `#${id}`} width={72} height={72} className="tk-nft-img tk-nft-img-lg" loading="lazy" />
          </div>
          <div className="col-md-4 col-lg tk-filter-main">
            <h4 className="tk-filter-title">
              <Hash size={14} className="tk-filter-icon" /> Filtered by Token ID
            </h4>
            <div className="fw-bold text-truncate" title={id}>
              #{id}
            </div>
            {name && <div className="small text-muted text-truncate">{name}</div>}
          </div>
          <FilterCol label="Owner">
            {owner === null ? (
              '-'
            ) : (
              <span className="d-flex align-items-center gap-1 tk-min0">
                <Link href={`/address/${owner.hash}`} className="text-truncate" title="View Address Page">
                  {owner.hash}
                </Link>
                <CopyButton text={owner.hash} label="Copy Address" />
              </span>
            )}
          </FilterCol>
          <FilterCol label="Transfers">{num(transfers)}</FilterCol>
        </div>
      </div>
    </div>
  )
}

/** The card above "?a=<txn hash>": this token's transfers inside one transaction. */
export function TxFilterCard({ hash }: { hash: string }) {
  return (
    <div className="card mb-1 tk-filter-card">
      <div className="card-body">
        <h4 className="tk-filter-title">
          <Receipt size={14} className="tk-filter-icon" /> Filtered by Transaction Hash
        </h4>
        <div className="d-flex align-items-center gap-1 tk-min0">
          <Link href={`/tx/${hash}`} className="fw-bold text-truncate" title="View Transaction">
            {hash}
          </Link>
          <CopyButton text={hash} label="Copy Transaction Hash" />
        </div>
      </div>
    </div>
  )
}
