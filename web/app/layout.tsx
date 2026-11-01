import 'bootstrap/dist/css/bootstrap.min.css'
import './globals.css'
import './styles/lists.css'
import './styles/address.css'
import './styles/token.css'
import './styles/chrome.css'
import './styles/tools.css'
import './styles/chain.css'
import './styles/tx.css'
import type { Metadata } from 'next'
import { Roboto } from 'next/font/google'
import { Highlighter } from '@/components/chrome-highlight'
import { LookalikeGuard } from '@/components/chrome-lookalike'
import { PrefsSync } from '@/components/chrome-prefs'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { SyncBanner } from '@/components/SyncBanner'
import { BOOT_SCRIPT, HTML_DEFAULT_ATTRS } from '@/lib/chrome-prefs'
import { SITE } from '@/lib/site'

// Every page shows live chain data (the header carries the coin price and gas), so nothing is prerendered.
export const dynamic = 'force-dynamic'

const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-roboto', display: 'swap' })

export const metadata: Metadata = {
  title: { default: `${SITE.tagline} | ${SITE.name}`, template: `%s | ${SITE.name}` },
  description: SITE.about,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The boot script rewrites these attributes from the visitor's stored prefs before the first paint, so React's
    // hydration finds other values than it rendered on <html> (and only there): suppressHydrationWarning.
    <html lang="en" className={roboto.variable} {...HTML_DEFAULT_ATTRS} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body id="top">
        <PrefsSync />
        <Highlighter />
        <LookalikeGuard />
        <Header />
        <SyncBanner />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
