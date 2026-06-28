import SettingsForm from '@/components/settings/SettingsForm'

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-dark">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your firm details</p>
      </div>
      <SettingsForm />
    </div>
  )
}
