import { ArrowUpToLine } from 'lucide-react'
import Link from 'next/link'
import { SITE } from '@/lib/site'
import { LogoMark } from './Logo'

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Explore',
    links: [
      { label: 'Transactions', href: '/txs' },
      { label: 'View Blocks', href: '/blocks' },
      { label: 'Top Tokens', href: '/tokens' },
      { label: 'Charts & Stats', href: '/charts' },
    ],
  },
  {
    title: 'Tools',
    links: [
      { label: 'Gas Tracker', href: '/gastracker' },
      { label: 'Unit Converter', href: '/unitconverter' },
      { label: 'Input Data Decoder', href: '/inputdatadecoder' },
      { label: 'Download Data', href: '/exportData' },
    ],
  },
]

/** footer#masterFooter: Back to Top, the about block with link columns, then the copyright row. */
export function Footer() {
  return (
    <footer id="masterFooter" className="ex-footer d-print-none">
      <div className="container-xxl">
        <div className="ex-footer-top d-flex justify-content-end align-items-center">
          <a href="#top" className="link-dark d-inline-flex align-items-center gap-1 fs-sm">
            <ArrowUpToLine size={14} aria-hidden="true" /> Back to Top
          </a>
        </div>
      </div>
      <hr className="my-0" />
      <div className="container-xxl">
        <div className="row justify-content-between ex-footer-main">
          <div className="col-lg-4 ex-footer-about mb-4 mb-lg-0">
            <div className="d-flex align-items-center gap-2 mb-3">
              <LogoMark size={20} />
              <span className="fs-5">Powered by {SITE.chainName}</span>
            </div>
            <p className="mb-0">{SITE.about}</p>
          </div>
          {COLUMNS.map((c) => (
            <div key={c.title} className="col-sm-4 col-lg-2 mb-4 mb-sm-0">
              <h4>{c.title}</h4>
              <ul>
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="link-dark">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="col-sm-4 col-lg-2">
            <h4>Network</h4>
            <ul className="text-muted">
              <li>Chain ID {SITE.chainId}</li>
              <li>Settles on {SITE.parentChain}</li>
              <li>Gas token {SITE.coin}</li>
              <li>
                <Link href="/settings" className="link-dark">
                  Site Settings
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="ex-footer-copy d-flex flex-wrap justify-content-between gap-2 text-muted">
          <span>
            {SITE.name} &copy; {new Date().getFullYear()}
          </span>
          <span>Independent explorer, not affiliated with the chain operator.</span>
        </div>
      </div>
    </footer>
  )
}
