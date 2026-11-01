import { PushTx } from '@/components/tools-pushtx'
import { ToolsLayout } from '@/components/tools-layout'
import { one, type SP } from '@/lib/page'
import { readRawTx } from '@/lib/tools-rawtx'

export const metadata = { title: 'Broadcast Raw Transaction' }

/** Etherscan's Broadcast Transaction (/pushTx). `?hex=` fills the field in after the same check the send route makes. */
export default async function PushTxPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const given = one(sp, 'hex')
  const prefill = given === undefined ? null : readRawTx(given)
  return (
    <ToolsLayout
      active="pushTx"
      title="Broadcast Raw Transaction"
      intro="This page allows you to paste a Signed Raw Transaction in hex format (i.e. characters 0-9, a-f) and broadcast it over the Elysium network."
    >
      {/* Keyed by the query so a new ?hex= link remounts the form with its value. */}
      <PushTx
        key={JSON.stringify(sp)}
        initial={prefill !== null && 'hex' in prefill ? prefill.hex : ''}
        initialError={prefill !== null && 'error' in prefill ? `The hex in this link cannot be used: ${prefill.error}` : null}
      />
    </ToolsLayout>
  )
}
