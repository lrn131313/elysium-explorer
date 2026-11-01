import { CircleHelp, Code2, FileCode2, Info, ListTree, Network } from 'lucide-react'
import Link from 'next/link'
import { addressOf } from '@/lib/address-api'
import { swarmSource } from '@/lib/address-metadata'
import { api } from '@/lib/api'
import type { AbiParam, AddressInfo, SmartContract } from '@/lib/types'
import { BytecodeBox, CodeBox, SourceViewer, type SourceFile } from './code'

const EXACT_TIP =
  "This contract's deployed bytecode exactly matches its submitted source code. Source code verification does not imply the contract is safe to interact with."
const PARTIAL_TIP =
  "This contract's deployed bytecode matches its submitted source code except for the metadata hash the compiler appends. Source code verification does not imply the contract is safe to interact with."

/** Etherscan's segmented "Code | Read Contract | Write Contract" switch; only Code exists so far. */
function SubNav() {
  return (
    <div className="ex-segment mb-4" role="tablist">
      <span className="ex-segment-item active" role="tab" aria-selected="true">
        Code
      </span>
    </div>
  )
}

function Meta({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="ex-meta-col">
      <h4 className="ex-cap mb-1">
        {label}
        {help && (
          <span title={help} className="ex-help ms-1">
            <CircleHelp size={12} />
          </span>
        )}
      </h4>
      <div>{children}</div>
    </div>
  )
}

/**
 * Etherscan's Constructor Arguments box: the raw ABI-encoded hex, then "Arg [0] : _factory (address): 0x…" lines
 * (when Blockscout could decode them), then the same hex as numbered 32-byte words.
 */
function constructorText(c: SmartContract): string | null {
  if (c.constructor_args === null || c.constructor_args === '0x' || c.constructor_args === '') return null
  const hex = c.constructor_args.startsWith('0x') ? c.constructor_args.slice(2) : c.constructor_args
  const words: string[] = []
  for (let i = 0; i < hex.length; i += 64) words.push(hex.slice(i, i + 64))
  const decoded =
    c.decoded_constructor_args === null
      ? []
      : c.decoded_constructor_args.map(
          ([value, p]: [unknown, AbiParam], i) => `Arg [${i}] : ${p.name} (${p.type}): ${typeof value === 'string' ? value : JSON.stringify(value)}`,
        )
  return [
    hex,
    '',
    ...(decoded.length > 0 ? ['-----Decoded View---------------', ...decoded, ''] : []),
    '-----Encoded View---------------',
    `${words.length} Constructor Arguments found :`,
    ...words.map((w, i) => `Arg [${i}] : ${w}`),
  ].join('\n')
}

function sourceFiles(c: SmartContract): SourceFile[] {
  const files: SourceFile[] = []
  if (c.source_code !== null) files.push({ path: c.file_path ?? `${c.name ?? 'Contract'}.sol`, code: c.source_code })
  for (const f of c.additional_sources ?? []) files.push({ path: f.file_path, code: f.source_code })
  if (c.compiler_settings) files.push({ path: 'settings.json', code: JSON.stringify(c.compiler_settings, null, 2), settings: true })
  return files
}

function Verified({ c, file }: { c: SmartContract; file: number }) {
  const files = sourceFiles(c)
  const exact = c.is_fully_verified === true
  const ctor = constructorText(c)
  const swarm = c.deployed_bytecode === null ? null : swarmSource(c.deployed_bytecode)
  return (
    <>
      <div className="ex-matchcard mb-4">
        <div className="d-flex align-items-center gap-2 pb-3">
          <span className="fw-bold" title={exact ? EXACT_TIP : PARTIAL_TIP}>
            {exact ? 'Exact Match' : 'Partial Match'}
          </span>
        </div>
        <div className="ex-meta-row">
          <Meta label="Contract Name">{c.name ?? '-'}</Meta>
          <Meta label="Compiler Version">{c.compiler_version ?? '-'}</Meta>
          <Meta label="Optimization Enabled">
            {c.optimization_enabled === null ? (
              '-'
            ) : (
              <>
                <span className="fw-bold">{c.optimization_enabled ? 'Yes' : 'No'}</span>
                {c.optimization_runs !== null && ` with ${c.optimization_runs} runs`}
              </>
            )}
          </Meta>
          <Meta label="Other Settings">{c.evm_version ? `${c.evm_version} EvmVersion` : '-'}</Meta>
          <Meta label="License" help="The license the author declared in the source (SPDX).">
            {!c.license_type || c.license_type === 'none' ? '-NA-' : c.license_type}
          </Meta>
        </div>
      </div>

      {files.length > 0 && (
        <section className="mb-4">
          <h3 className="ex-codebox-title mb-3">
            <FileCode2 size={16} />
            Contract Source Code{' '}
            <span className="fw-normal">
              ({c.language === 'vyper' ? 'Vyper' : 'Solidity'}
              {c.compiler_settings ? ' Standard Json-Input format' : ''})
            </span>
          </h3>
          <SourceViewer files={files} initial={file} />
        </section>
      )}

      {c.abi && <CodeBox title="Contract ABI" icon={<ListTree size={16} />} text={JSON.stringify(c.abi)} />}
      {c.creation_bytecode !== null && <BytecodeBox title="Contract Creation Code" bytecode={c.creation_bytecode} />}
      {c.deployed_bytecode !== null && <BytecodeBox title="Deployed Bytecode" bytecode={c.deployed_bytecode} />}
      {ctor && (
        <CodeBox
          title={
            <>
              Constructor Arguments <span className="fw-normal text-muted">(ABI-Encoded and is the last bytes of the Contract Creation Code above)</span>
            </>
          }
          icon={<Code2 size={16} />}
          text={ctor}
        />
      )}
      {swarm !== null && <CodeBox title="Swarm Source" icon={<Network size={16} />} text={swarm} />}
    </>
  )
}

/** `factory`: the contract that created this one, when a contract did ("created by the contract code at …"). */
function Unverified({ c, factory }: { c: SmartContract; factory: string | null }) {
  return (
    <>
      <p className={`d-flex align-items-center gap-2 ${factory === null ? 'mb-4' : 'mb-2'}`}>
        <Info size={15} className="text-muted flex-shrink-0" />
        <span>
          Are you the contract creator? <span className="fw-bold">Verify and Publish</span> your contract source code today!
        </span>
      </p>
      {factory !== null && (
        <p className="text-muted mb-4">
          This contract was created by the contract code at <Link href={`/address/${factory}?tab=contract`}>{factory}</Link>
        </p>
      )}
      {c.creation_bytecode !== null && <BytecodeBox title="Contract Creation Code" bytecode={c.creation_bytecode} />}
      {c.deployed_bytecode === null ? (
        <p className="text-muted">No code is deployed at this address.</p>
      ) : (
        <BytecodeBox title="Deployed Bytecode" bytecode={c.deployed_bytecode} />
      )}
    </>
  )
}

/**
 * The address page's Contract tab: verified source, ABI and constructor arguments when there are any; the creation and
 * deployed bytecode always (the owner wants both for every contract, so creation code is shown even where Etherscan
 * leaves it out for factory-made contracts). Read / Write Contract are not offered. Blockscout sends an unverified
 * contract's record without `is_verified`, hence the strict test.
 */
export async function ContractTab({ a, file }: { a: AddressInfo; file: number }) {
  const [c, creator] = await Promise.all([api.contract(a.hash), a.creator_address_hash === null ? null : addressOf(a.creator_address_hash)])
  const factory = creator !== null && creator.is_contract ? creator.hash : null
  return (
    <div className="card mb-3">
      <div className="card-body ex-contract">
        <SubNav />
        {c.is_verified === true ? <Verified c={c} file={file} /> : <Unverified c={c} factory={factory} />}
      </div>
    </div>
  )
}
