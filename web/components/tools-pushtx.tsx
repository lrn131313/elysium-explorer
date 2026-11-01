'use client'

import Link from 'next/link'
import { useState } from 'react'
import { readRawTx } from '@/lib/tools-rawtx'
import { ToolCard } from './tools-layout'

/** What came of a send: the hash the node gave back, or a message, and whether that message is the node's own. */
type Outcome = { hash: string } | { error: string; byNode: boolean }

/** The route's answer as the form shows it. Its JSON is read only for the statuses the route itself answers with. */
async function answerOf(res: Response): Promise<Outcome> {
  if (res.status === 200) {
    const body = (await res.json()) as { hash: string }
    return { hash: body.hash }
  }
  if (res.status === 400 || res.status === 413 || res.status === 415 || res.status === 422) {
    const body = (await res.json()) as { error: string; from: 'node' | 'explorer' }
    return { error: body.error, byNode: body.from === 'node' }
  }
  // Anything else (a 500: the node could not be reached or answered nonsense) leaves it open whether the node got it.
  return {
    error: `The explorer got no clear answer from the node (HTTP ${res.status}). The transaction may or may not have been sent; look it up by its hash before sending it again.`,
    byNode: false,
  }
}

/** Etherscan's Broadcast Transaction: a signed raw transaction, sent through our node, never on its own (no auto-send). */
export function PushTx({ initial, initialError }: { initial: string; initialError: string | null }) {
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(initialError === null ? null : { error: initialError, byNode: false })

  const send = async (): Promise<Outcome> => {
    const tx = readRawTx(text)
    if ('error' in tx) return { error: tx.error, byNode: false }
    let res: Response
    try {
      res = await fetch('/pushTx/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hex: tx.hex }) })
    } catch (e) {
      // fetch rejects only when no answer came back (offline, server gone mid-request); say so, and that it is unknown.
      return { error: `Sending failed: ${e instanceof Error ? e.message : String(e)}. The transaction may or may not have reached the node.`, byNode: false }
    }
    return answerOf(res)
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setBusy(true)
          setOutcome(null)
          send()
            .then(setOutcome, (err: unknown) => {
              // send() turns every expected failure into an outcome; anything left is a bug, rethrown for the error page.
              setOutcome(() => {
                throw err
              })
            })
            .finally(() => setBusy(false))
        }}
      >
        <ToolCard
          footer={
            <>
              <button type="submit" className="btn btn-primary tl-btn" disabled={busy}>
                {busy ? 'Sending…' : 'Send Transaction'}
              </button>
              <button
                type="button"
                className="btn tl-ghost tl-btn"
                onClick={() => {
                  setText('')
                  setOutcome(null)
                }}
              >
                Reset
              </button>
            </>
          }
        >
          <div className="tl-field">
            <label className="form-label" htmlFor="pushtx-hex">
              Enter signed transaction hex
            </label>
            <textarea
              id="pushtx-hex"
              className="form-control"
              rows={8}
              placeholder="e.g. 0x.."
              spellCheck={false}
              autoComplete="off"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="tl-tip">
              Tip: a link can fill this field in with the <code>hex</code> parameter, for example <code>/pushTx?hex=0x..</code>. The transaction is only sent when you press
              Send Transaction.
            </p>
          </div>
        </ToolCard>
      </form>
      {outcome !== null &&
        ('hash' in outcome ? (
          <div className="alert alert-success py-2 mt-3 text-break" role="status">
            The node accepted the transaction. Hash:{' '}
            <Link href={`/tx/${outcome.hash}`} className="font-monospace">
              {outcome.hash}
            </Link>
            <div className="tl-tip">It appears on the transaction page once it is included in a block.</div>
          </div>
        ) : (
          <div className="alert alert-danger py-2 mt-3 text-break" role="alert">
            {outcome.byNode ? (
              <>
                The node refused the transaction: <span className="font-monospace">{outcome.error}</span>
              </>
            ) : (
              outcome.error
            )}
          </div>
        ))}
    </>
  )
}
