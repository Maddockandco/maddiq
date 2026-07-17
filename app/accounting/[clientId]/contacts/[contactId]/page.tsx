'use client'
import ContactDetail from '@/components/accounting/ContactDetail'

export default function ContactDetailPage({ params }: { params: { clientId: string; contactId: string } }) {
  return <ContactDetail clientId={params.clientId} contactId={params.contactId} />
}
