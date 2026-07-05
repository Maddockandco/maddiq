'use client'
import AccountingSettings from '@/components/accounting/AccountingSettings'

export default function SettingsPage({ params }: { params: { clientId: string } }) {
  return <AccountingSettings clientId={params.clientId} />
}
