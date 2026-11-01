import Link from 'next/link'
import { SITE } from '@/lib/site'

export const metadata = { title: `${SITE.name} Error Page` }

/** Etherscan's /404: a plain muted text block, then "Back Home". */
export default function NotFound() {
  return (
    <section className="container-xxl ex-errpage">
      <div className="text-muted ex-errpage-body">
        <div className="mb-4">
          <h1>
            <span>404</span>That is an error!
          </h1>
          <p className="mb-0">The requested URL was not found on this server. That is all we know.</p>
          <p>
            It may be an address, transaction or block that is not on {SITE.chainName}, or one that is not indexed yet.
          </p>
        </div>
        <Link href="/" className="btn btn-lg btn-primary">
          Back Home
        </Link>
      </div>
    </section>
  )
}
