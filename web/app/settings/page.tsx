import { SettingsForm } from '@/components/chrome-settings'
import { SITE } from '@/lib/site'

export const metadata = { title: 'Site Settings' }

/** Etherscan's /settings, with only the preferences this explorer really applies. Nothing needs an account. */
export default function SettingsPage() {
  return (
    <section className="container-xxl ex-settings">
      <h1>Site Settings</h1>
      <p>This page allows you to customize your browsing experience on {SITE.name}.</p>
      <div className="row">
        <div className="col-lg-8 col-xl-6">
          <SettingsForm />
          <p className="text-muted fs-sm">* Site preferences are saved in this browser&apos;s local storage and never leave your device.</p>
        </div>
      </div>
    </section>
  )
}
