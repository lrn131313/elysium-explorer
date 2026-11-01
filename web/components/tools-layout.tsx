import Link from 'next/link'
import { Fragment } from 'react'
import { PageHead } from './ui'
import { ToolsMenu } from './tools-menu'

/** The developer tools, by their flat URL (TEAM.md §3). */
export type ToolKey = 'exportData' | 'balancecheck-tool' | 'inputdatadecoder' | 'opcode-tool' | 'pushTx' | 'unitconverter'

/** Etherscan's sidebar groups and order (chrome.md §3.0), holding only the tools this explorer has. */
const GROUPS: { key: ToolKey; label: string }[][] = [
  [
    { key: 'exportData', label: 'CSV Export' },
    { key: 'balancecheck-tool', label: 'Account Balance Checker' },
    { key: 'inputdatadecoder', label: 'Input Data Decoder' },
  ],
  [
    { key: 'opcode-tool', label: 'Bytecode to Opcode' },
    { key: 'pushTx', label: 'Broadcast Transaction' },
  ],
  [{ key: 'unitconverter', label: 'Unit Converter' }],
]

/**
 * Etherscan's tools page: a "Tools" heading, the sticky tools menu on the left, and on the right the tool's title, its
 * one-paragraph intro and then the tool itself (`children`, usually a ToolCard).
 */
export function ToolsLayout({
  active,
  title,
  intro,
  children,
}: {
  active: ToolKey
  title: React.ReactNode
  intro: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <>
      <div className="container-xxl">
        <PageHead title="Tools" />
      </div>
      <div className="container-xxl tl-body">
        <div className="row tl-row">
          <aside className="col-lg-3 col-xxl-2 tl-aside">
            <ToolsMenu>
              <ul className="tl-nav">
                {GROUPS.map((group, i) => (
                  <Fragment key={i}>
                    {i > 0 && (
                      <li aria-hidden="true">
                        <hr className="tl-nav-sep" />
                      </li>
                    )}
                    {group.map((t) => (
                      <li key={t.key}>
                        <Link
                          href={`/${t.key}`}
                          className={`tl-nav-link${t.key === active ? ' active' : ''}`}
                          aria-current={t.key === active ? 'page' : undefined}
                        >
                          {t.label}
                        </Link>
                      </li>
                    ))}
                  </Fragment>
                ))}
              </ul>
            </ToolsMenu>
          </aside>
          <div className="col-lg-9 col-xxl-10">
            <div className="tl-intro">
              <h2 className="tl-title">{title}</h2>
              <p>{intro}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </>
  )
}

/** Etherscan's "Beta" pill after a tool's title. */
export const Beta = () => <span className="tl-beta">Beta</span>

/** The tool's card: the form fields in the body, the buttons in the grey footer. */
export function ToolCard({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="card tl-card">
      <div className="card-body">{children}</div>
      {footer !== undefined && <div className="card-footer">{footer}</div>}
    </div>
  )
}
