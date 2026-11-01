import { History, ListChecks, Tag } from 'lucide-react'
import Link from 'next/link'
import { displayName } from '@/components/AddressLink'
import { AddressMenu } from '@/components/address-menu'
import { CopyButton } from '@/components/client'
import { getLabels } from '@/lib/labels'
import type { AddressInfo } from '@/lib/types'

/** Etherscan's tooltip on the green "Source Code" pill, verbatim. */
const SOURCE_TIP =
  'The contract’s source code has been verified to match its on-chain creation and runtime bytecode. Source code verification does not imply the contract is safe to interact with.'

/** The 24px round picture before the title: the token's logo when it has one, else a plain grey disc. */
function HeadIcon({ src }: { src: string | null }) {
  if (src === null) return <span className="address-head-icon" aria-hidden="true" />
  // A token logo can live on any host, and next/image would need each host listed in next.config: a plain, fixed-size <img>.
  return <img src={src} width={24} height={24} className="address-head-icon" alt="" />
}

/** Title ("Contract" / "Address"), the full address and its copy button, over the header's bottom border. */
export function AddressHeader({ a }: { a: AddressInfo }) {
  return (
    <div className="ex-page-head address-head">
      <div className="d-flex flex-wrap text-break align-items-center gap-2">
        <div className="d-flex align-items-center gap-2">
          <HeadIcon src={a.token === null ? null : a.token.icon_url} />
          <h1 className="ex-page-title">{a.is_contract ? 'Contract' : 'Address'}</h1>
        </div>
        <div>
          <span className="address-main me-3">{a.hash}</span>
          <span className="d-inline-flex align-items-center gap-4 address-head-tools">
            <CopyButton text={a.hash} label="Copy Address" />
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * The pill row above the cards: the address's name (a name tag, or the contract's / token's own name), the green
 * "Source Code" pill of a verified contract and the token standard of a token contract; on the right the "more" menu.
 */
export async function BadgeRow({ a }: { a: AddressInfo }) {
  const labels = await getLabels()
  const name = displayName(a, labels)
  const tagged = labels.has(a.hash.toLowerCase()) || (a.public_tags !== null && a.public_tags.length > 0)
  const tip = tagged ? `Public Name Tag (viewable by anyone)\n${name}\n(${a.hash})` : `${name}\n(${a.hash})`
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-2">
      <div className="d-flex flex-wrap align-items-center gap-1">
        {name !== null && (
          <span className="address-pill address-pill-tag" title={tip}>
            <Tag size={11} className="address-pill-icon" aria-hidden="true" />
            <span className="address-pill-text">{name}</span>
          </span>
        )}
        {a.is_verified === true && (
          <span className="address-pill address-pill-source" title={SOURCE_TIP}>
            Source Code
          </span>
        )}
        {a.token !== null && (
          <Link href={`/token/${a.hash}`} className="address-pill address-pill-white" title="View Token Tracker Page">
            {a.token.type}
          </Link>
        )}
      </div>
      <AddressMenu label={<ListChecks size={14} />} title="More options">
        <Link className="address-menu-item" href={`/balancecheck-tool?a=${a.hash}`}>
          <History size={14} className="address-menu-icon" />
          Check Previous Balance
        </Link>
      </AddressMenu>
    </div>
  )
}
