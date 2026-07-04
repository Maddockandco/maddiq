'use client'
import Contacts from '@/components/accounting/Contacts'

export default function ContactsPage({ params }: { params: { clientId: string } }) {
  return <Contacts clientId={params.clientId} />
}
