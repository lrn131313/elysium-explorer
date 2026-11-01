import { FileText } from 'lucide-react'
import Link from 'next/link'
import { getLabels, type Label } from '@/lib/labels'
import type { AddressParam } from '@/lib/types'
import { CopyButton } from './client'

/**
 * The name to show for an address, in Etherscan's order: our name tag (curated or a named pool), Blockscout's
 * public tag, the verified contract name, then the ENS name. Null when none is known.
 */
export function displayName(a: Pick<AddressParam, 'hash' | 'name' | 'ens_domain_name' | 'public_tags'>, labels: ReadonlyMap<string, Label>): string | null {
  return labels.get(a.hash.toLowerCase())?.name ?? a.public_tags?.[0]?.display_name ?? a.name ?? a.ens_domain_name ?? null
}

/**
 * "0xa1023Ec7…a2e76004a": Etherscan keeps the middle characters in the page (zero-size, an ellipsis drawn in
 * their place), so find-in-page and copying the text still match the whole address.
 */
export function MidHash({ hash, head = 10, tail = 9 }: { hash: string; head?: number; tail?: number }) {
  if (hash.length <= head + tail + 1) return <>{hash}</>
  return (
    <>
      {hash.slice(0, head)}
      <span className="ex-mid">{hash.slice(head, hash.length - tail)}</span>
      {hash.slice(hash.length - tail)}
    </>
  )
}

/** Address shown as its name tag when known, else the shortened hash; contracts get a page icon. */
export async function AddressLink({
  a,
  full = false,
  copy = false,
  current,
  head = 10,
  tail = 9,
  href,
}: {
  a: AddressParam
  full?: boolean
  copy?: boolean
  current?: string
  head?: number
  tail?: number
  href?: string // where the link goes, when not the address page (e.g. a token page filtered by this holder)
}) {
  const label = displayName(a, await getLabels())
  const text = label ?? (full ? a.hash : <MidHash hash={a.hash} head={head} tail={tail} />)
  const title = label ? `${label}\n(${a.hash})` : a.hash
  const isCurrent = current !== undefined && current.toLowerCase() === a.hash.toLowerCase()
  const hl = a.hash.toLowerCase()
  return (
    <span className="ex-addr d-inline-flex align-items-center gap-1">
      {a.is_contract && (
        <span className="ex-contract-icon" title="Contract">
          <FileText size={13} aria-label="Contract" />
        </span>
      )}
      {isCurrent ? (
        <span className="ex-addr-text" title={title} data-hl={hl}>
          {text}
        </span>
      ) : (
        <Link className="ex-addr-text" href={href ?? `/address/${a.hash}`} title={title} data-hl={hl}>
          {text}
        </Link>
      )}
      {copy && <CopyButton text={a.hash} label="Copy Address" />}
    </span>
  )
}
