'use client'

import JournalEntries from '@/components/accounting/JournalEntries'

export default function AccountingJournalEntriesPage({ params }: { params: { clientId: string } }) {
  return <JournalEntries clientId={params.clientId} />
}
