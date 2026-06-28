import PageHeader from '@/components/layout/PageHeader'
import SettingsForm from '@/components/settings/SettingsForm'

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your firm details"
      />
      <SettingsForm />
    </div>
  )
}
