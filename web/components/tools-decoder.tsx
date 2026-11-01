'use client'

import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { COIN, isAddress, isTxHash } from '@/lib/format'
import {
  AbiError,
  abiFunctions,
  canonical,
  decodeCall,
  describeCall,
  formatValue,
  hexToBytes,
  parseAbiJson,
  parseSignature,
  selectorOf,
  selectorOfData,
  type AbiFunction,
  type DecodedCall,
} from '@/lib/tools-abi'
import { ToolCard } from './tools-layout'

type Option = 'tx' | 'address' | 'abi' | 'noabi'

const OPTIONS: { key: Option; label: string }[] = [
  { key: 'tx', label: 'from Transaction' },
  { key: 'address', label: 'from Address' },
  { key: 'abi', label: 'from ABI' },
  { key: 'noabi', label: 'without ABI' },
]

/** Where the function came from: a verified ABI, the pasted ABI, or a guess from the signature database by selector. */
type Source = { kind: 'verified'; address: string } | { kind: 'pasted' } | { kind: 'database'; others: string[] }

type Outcome = { call: DecodedCall; source: Source } | { error: string }

/**
 * A GET to one of the decoder's lookups (`what` names it in messages). A request that cannot be made at all, or an
 * error status, becomes a message for the form; `notFound` is the message for a 404.
 */
async function lookup<T>(url: string, what: string, notFound = `${what} found nothing.`): Promise<T> {
  let res: Response
  try {
    res = await fetch(url)
  } catch (e) {
    // fetch rejects only when no answer came back (offline, server down); the form says so instead of failing silently.
    throw new AbiError(`${what} failed: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (res.status === 404) throw new AbiError(notFound)
  if (!res.ok) throw new AbiError(`${what} failed (HTTP ${res.status}).`)
  return (await res.json()) as T
}

/** The call decoded with the ABI's function for its selector; null when the ABI has no such function. */
function withAbi(fns: AbiFunction[], input: Uint8Array): DecodedCall | null {
  const selector = selectorOfData(input)
  const f = fns.find((x) => selectorOf(x) === selector)
  return f === undefined ? null : decodeCall(f, input)
}

/** The call decoded by the signatures the database knows for its selector: the first that the data fits. */
async function fromDatabase(input: Uint8Array): Promise<Outcome> {
  const selector = selectorOfData(input)
  const { signatures } = await lookup<{ signatures: string[] }>(`/inputdatadecoder/signatures?selector=${selector}`, 'The signature lookup')
  if (signatures.length === 0)
    throw new AbiError(
      `The function ${selector} is not in the signature database (only signatures seen in verified contracts are used). Paste the contract’s ABI to decode it.`,
    )
  const fits: DecodedCall[] = []
  const misfits: string[] = []
  for (const sig of signatures) {
    try {
      fits.push(decodeCall(parseSignature(sig), input))
    } catch (e) {
      // A candidate the data does not fit is set aside with the reason; any other error is a bug and propagates.
      if (!(e instanceof AbiError)) throw e
      misfits.push(`${sig}: ${e.message}`)
    }
  }
  const [first, ...rest] = fits
  if (first === undefined)
    throw new AbiError(`The input data does not fit ${signatures.length === 1 ? 'the known function' : 'any known function'} for ${selector}. ${misfits.join(' ')}`)
  return { call: first, source: { kind: 'database', others: rest.map((c) => c.signature) } }
}

/** Etherscan's Input Data Decoder: from a transaction, a verified contract, a pasted ABI, or the selector alone. */
export function InputDataDecoder() {
  const [option, setOption] = useState<Option>('tx')
  const [txHash, setTxHash] = useState('')
  const [address, setAddress] = useState('')
  const [abiText, setAbiText] = useState('')
  const [inputText, setInputText] = useState('')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const readInput = (): Uint8Array => {
    const input = hexToBytes(inputText, 'input data')
    if (input.length === 0) throw new AbiError('Enter the input data.')
    return input
  }

  const run = async (): Promise<Outcome> => {
    switch (option) {
      case 'tx': {
        const hash = txHash.trim()
        if (!isTxHash(hash)) throw new AbiError('Enter a transaction hash: 0x followed by 64 hexadecimal characters.')
        const tx = await lookup<{ input: string; to: string | null; abi: unknown[] | null }>(`/inputdatadecoder/tx?hash=${hash}`, 'Loading the transaction', 'There is no transaction with this hash on Elysium.')
        if (tx.to === null) throw new AbiError('This transaction creates a contract: its input data is the contract’s creation code, not a function call.')
        const input = hexToBytes(tx.input, 'input data')
        if (input.length === 0) throw new AbiError(`This transaction carries no input data: it is a plain ${COIN} transfer.`)
        if (tx.abi !== null) {
          const call = withAbi(abiFunctions(tx.abi), input)
          if (call !== null) return { call, source: { kind: 'verified', address: tx.to } }
        }
        // No verified ABI, or one without this function (a proxy's own ABI): look the selector up instead.
        return fromDatabase(input)
      }
      case 'address': {
        const a = address.trim()
        if (!isAddress(a)) throw new AbiError('Enter a contract address: 0x followed by 40 hexadecimal characters.')
        const input = readInput()
        const { abi } = await lookup<{ abi: unknown[] | null }>(`/inputdatadecoder/abi?a=${a}`, 'Loading the contract’s ABI')
        if (abi === null) throw new AbiError(`${a} is not a contract verified on this explorer, so its ABI is not known. Choose “without ABI” to look the function up by its selector.`)
        const call = withAbi(abiFunctions(abi), input)
        if (call === null) throw new AbiError(`No function in the verified ABI of ${a} has the selector ${selectorOfData(input)}.`)
        return { call, source: { kind: 'verified', address: a } }
      }
      case 'abi': {
        if (abiText.trim() === '') throw new AbiError('Paste the contract’s ABI.')
        const fns = parseAbiJson(abiText)
        const input = readInput()
        const call = withAbi(fns, input)
        if (call === null) throw new AbiError(`No function in this ABI has the selector ${selectorOfData(input)}.`)
        return { call, source: { kind: 'pasted' } }
      }
      case 'noabi':
        return fromDatabase(readInput())
    }
  }

  const reset = () => {
    setOption('tx')
    setTxHash('')
    setAddress('')
    setAbiText('')
    setInputText('')
    setOutcome(null)
  }

  const hash = txHash.trim()
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setBusy(true)
          run()
            .then(setOutcome, (err: unknown) => {
              if (err instanceof AbiError) setOutcome({ error: err.message })
              // Anything else is a bug: rethrown during render so the error page shows it.
              else
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
                {busy ? 'Decoding…' : 'Decode'}
              </button>
              <button type="button" className="btn tl-ghost tl-btn" onClick={reset}>
                Reset
              </button>
            </>
          }
        >
          <fieldset className="tl-field">
            <legend className="form-label tl-legend">Choose option:</legend>
            <div className="d-flex flex-wrap gap-3">
              {OPTIONS.map((o) => (
                <div key={o.key} className="form-check">
                  <input
                    id={`decoder-${o.key}`}
                    className="form-check-input"
                    type="radio"
                    name="option"
                    value={o.key}
                    checked={option === o.key}
                    onChange={() => {
                      setOption(o.key)
                      setOutcome(null)
                    }}
                  />
                  <label className="form-check-label" htmlFor={`decoder-${o.key}`}>
                    {o.label}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
          {option === 'tx' && (
            <div className="tl-field">
              <label className="form-label" htmlFor="decoder-hash">
                Txn Hash
              </label>
              <div className="row g-2 align-items-start">
                <div className="col col-xxl-6">
                  <input
                    id="decoder-hash"
                    className="form-control"
                    placeholder="Transaction Hash"
                    autoComplete="off"
                    spellCheck={false}
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                  />
                </div>
                {isTxHash(hash) && (
                  <div className="col-auto">
                    <Link href={`/tx/${hash}`} className="btn btn-white d-inline-flex align-items-center" title="View Transaction Details" aria-label="View Transaction Details">
                      <ArrowUpRight size={15} />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
          {option === 'address' && (
            <div className="row tl-field">
              <div className="col-xl-6">
                <label className="form-label" htmlFor="decoder-address">
                  Contract Address
                </label>
                <input
                  id="decoder-address"
                  className="form-control"
                  placeholder="0x..."
                  autoComplete="off"
                  spellCheck={false}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>
          )}
          {option === 'abi' && (
            <div className="tl-field">
              <label className="form-label" htmlFor="decoder-abi">
                ABI
              </label>
              <textarea
                id="decoder-abi"
                className="form-control"
                rows={6}
                placeholder='[{"type":"function","name":"transfer","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}]}]'
                autoComplete="off"
                spellCheck={false}
                value={abiText}
                onChange={(e) => setAbiText(e.target.value)}
              />
            </div>
          )}
          {option !== 'tx' && (
            <div className="tl-field">
              <label className="form-label" htmlFor="decoder-input">
                Input Data
              </label>
              <textarea
                id="decoder-input"
                className="form-control"
                rows={6}
                placeholder="0x..."
                autoComplete="off"
                spellCheck={false}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>
          )}
        </ToolCard>
      </form>
      {outcome !== null &&
        ('error' in outcome ? (
          <div className="alert alert-danger py-2 mt-3 text-break" role="alert">
            {outcome.error}
          </div>
        ) : (
          <Decoded call={outcome.call} source={outcome.source} />
        ))}
    </>
  )
}

function SourceNote({ source }: { source: Source }) {
  switch (source.kind) {
    case 'verified':
      return (
        <>
          Decoded with the verified ABI of{' '}
          <Link href={`/address/${source.address}`} className="font-monospace">
            {source.address}
          </Link>
          .
        </>
      )
    case 'pasted':
      return <>Decoded with the ABI you entered.</>
    case 'database':
      return (
        <>
          The function was found by its selector in a public signature database (signatures seen in verified contracts), so
          parameter names are not known.
          {source.others.length > 0 && ` The data also fits ${source.others.join(', ')}.`}
        </>
      )
  }
}

/** The decoded call: Etherscan's "Function:" and "MethodID:" lines, then # · Name · Type · Data. */
function Decoded({ call, source }: { call: DecodedCall; source: Source }) {
  return (
    <div className="card tl-card mt-3">
      <div className="card-body">
        <div className="tl-call">
          <span className="text-muted">Function:</span> <span className="font-monospace text-break">{describeCall(call)}</span>
        </div>
        <div className="tl-call">
          <span className="text-muted">MethodID:</span> <span className="font-monospace">{call.selector}</span>
        </div>
        <p className="tl-tip">
          <SourceNote source={source} />
        </p>
      </div>
      {call.params.length === 0 ? (
        <div className="card-body pt-0">This function takes no parameters.</div>
      ) : (
        <div className="ex-table-wrap tl-params">
          <table className="ex-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col">Data</th>
              </tr>
            </thead>
            <tbody>
              {call.params.map((p, i) => (
                <tr key={i}>
                  <td>{i}</td>
                  <td>{p.name === '' ? '-' : p.name}</td>
                  <td className="font-monospace">{canonical(p.type)}</td>
                  <td className="font-monospace tl-data">
                    {p.value.kind === 'address' ? <Link href={`/address/${p.value.value}`}>{p.value.value}</Link> : formatValue(p.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
