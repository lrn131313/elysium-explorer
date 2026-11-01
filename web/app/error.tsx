'use client'

import Link from 'next/link'

/** Etherscan's /error shell: "Sorry! We encountered an unexpected error.", then the way out. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="container-xxl ex-errpage">
      <div className="text-muted ex-errpage-body">
        <div className="mb-4">
          <h1>
            <span>Sorry!</span>We encountered an unexpected error.
          </h1>
          <p className="mb-0 text-break">
            The explorer backend did not answer. It may be restarting or still indexing.
            <br />
            Please try again in a moment.
          </p>
          {error.digest && <p className="fs-sm mt-2 mb-0">Reference: {error.digest}</p>}
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button type="button" className="btn btn-lg btn-primary" onClick={reset}>
            Try Again
          </button>
          <Link href="/" className="btn btn-lg btn-white">
            Back Home
          </Link>
        </div>
      </div>
    </section>
  )
}
