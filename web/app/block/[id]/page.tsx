import { ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import Link from 'next/link'
import { AddressLink } from '@/components/AddressLink'
import { CopyButton, TimeAgo } from '@/components/client'
import { Hr, Note, PageHead, Row } from '@/components/ui'
import { api } from '@/lib/api'
import { coin, gwei, num, utc } from '@/lib/format'
import { orNotFound } from '@/lib/page'
import { SITE } from '@/lib/site'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `Block #${(await params).id}` }
}

export default async function BlockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b = await orNotFound(api.block(id))
  return (
    <div className="container-xxl">
      <PageHead title="Block">
        <span className="text-muted">#{b.height}</span>
      </PageHead>
      <div className="card mb-3">
        <div className="card-body ex-dl">
          <Row label="Block Height" help="Also known as block number: the position of this block in the chain.">
            <span className="d-inline-flex align-items-center gap-2">
              <strong className="fw-medium">{b.height}</strong>
              <Link href={`/block/${b.height - 1}`} className="ex-iconbtn" style={{ width: 24, height: 24 }} aria-label="Previous block">
                <ChevronLeft size={14} />
              </Link>
              <Link href={`/block/${b.height + 1}`} className="ex-iconbtn" style={{ width: 24, height: 24 }} aria-label="Next block">
                <ChevronRight size={14} />
              </Link>
            </span>
          </Row>
          <Row label="Timestamp" help="When the sequencer produced this block.">
            <span className="d-inline-flex align-items-center gap-1">
              <Clock3 size={14} /> <TimeAgo ts={b.timestamp} /> ({utc(b.timestamp)})
            </span>
          </Row>
          <Row label="Transactions" help="Transactions in this block, including the ArbOS system transaction.">
            <Link href={`/txs?block=${b.height}`}>
              {b.transactions_count} {b.transactions_count === 1 ? 'transaction' : 'transactions'}
            </Link>
            {b.internal_transactions_count !== null && b.internal_transactions_count > 0 && (
              <span> and {b.internal_transactions_count} contract internal transactions</span>
            )}{' '}
            in this block
          </Row>
          {b.arbitrum && (
            <>
              <Hr />
              <Row label="Batch" help={`The batch this block was posted to ${SITE.parentChain} in.`}>
                {b.arbitrum.batch_number ?? 'Not posted yet'}
              </Row>
              <Row label={`${SITE.parentChain} Block`} help="Parent-chain block height reported by ArbOS for this block.">
                {b.arbitrum.l1_block_height ?? '-'}
              </Row>
            </>
          )}
          <Hr />
          <Row label="Fee Recipient" help="Address that received the transaction fees (the sequencer's fee address).">
            <AddressLink a={b.miner} full copy />
          </Row>
          <Row label="Size" help="Block size in bytes.">
            {num(b.size)} bytes
          </Row>
          <Row label="Gas Used" help="Total gas used by all transactions in this block.">
            {num(b.gas_used)}
            {b.gas_used_percentage !== null && <span className="text-muted"> ({b.gas_used_percentage.toFixed(4)}%)</span>}
          </Row>
          <Row label="Gas Limit" help="Maximum gas allowed in this block.">
            {num(b.gas_limit)}
          </Row>
          <Row label="Base Fee Per Gas" help="Minimum price per unit of gas for inclusion in this block.">
            {b.base_fee_per_gas ? `${coin(b.base_fee_per_gas)} (${gwei(b.base_fee_per_gas)})` : '-'}
          </Row>
          <Row label="Transaction Fees" help="Sum of the fees paid by this block's transactions.">
            {coin(b.transaction_fees ?? '0')}
          </Row>
          <Row label="Burnt Fees" help="Base fee multiplied by gas used.">
            {coin(b.burnt_fees ?? '0')}
          </Row>
          <Hr />
          <Row label="Hash" help="Hash of this block's header.">
            <span className="font-mono">{b.hash}</span> <CopyButton text={b.hash} />
          </Row>
          <Row label="Parent Hash" help="Hash of the previous block.">
            <Link href={`/block/${b.parent_hash}`} className="font-mono">
              {b.parent_hash}
            </Link>
          </Row>
          <Row label="Nonce" help="On Arbitrum chains the header nonce carries the number of delayed messages read.">
            {b.nonce}
          </Row>
        </div>
      </div>
      <Note>Blocks are produced by the {SITE.chainName} sequencer and posted in batches to {SITE.parentChain}.</Note>
    </div>
  )
}
