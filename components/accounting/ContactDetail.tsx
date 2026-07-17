'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import TransactionAuditTrail from '@/components/accounting/TransactionAuditTrail'

export default function ContactDetail({ clientId, contactId }: { clientId: string; contactId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const { can } = useRole()

  const [contact, setContact] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [contactId])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('contacts').select('*').eq('id', contactId).single()
    setContact(data)
    setLoading(false)
  }

  if (loading) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading contact...</p>
    </div>
  )

  if (!contact) return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Contact not found</p>
    </div>
  )

  function Field({ label, value }: { label: string; value: any }) {
    if (!value) return null
    return (
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-brand-dark">{value}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push(`/accounting/${clientId}/contacts`)}
        className="text-sm text-brand-dark font-medium hover:underline flex items-center gap-1"
      >
        ← Back to contacts
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-brand-dark">{contact.name}</h1>
            <div className="flex gap-2 mt-1">
              {contact.is_customer && <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">Customer</span>}
              {contact.is_supplier && <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">Supplier</span>}
            </div>
          </div>
          {can.manageEngagements && (
            <button
              onClick={() => router.push(`/accounting/${clientId}/contacts?edit=${contactId}`)}
              className="bg-gray-100 text-brand-dark font-semibold px-4 py-2 rounded-xl text-sm hover:bg-gray-200 transition"
            >
              Edit
            </button>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-3">Contact Details</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Contact Person" value={contact.contact_person} />
              <Field label="Email" value={contact.email} />
              <Field label="Phone" value={contact.phone} />
              <Field label="Website" value={contact.website} />
              <Field label="Payment Terms" value={contact.payment_terms_days === 0 ? 'Due on Receipt' : `${contact.payment_terms_days} days`} />
              <Field label="Account Reference" value={contact.account_reference} />
            </div>
          </div>

          {(contact.company_number || contact.vat_number || contact.company_status) && (
            <div className="pt-6 border-t border-gray-100">
              <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-3">Company Details</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Company Number" value={contact.company_number} />
                <Field label="Company Status" value={contact.company_status} />
                <Field label="Incorporated On" value={contact.incorporated_on ? new Date(contact.incorporated_on).toLocaleDateString('en-GB') : null} />
                <Field label="VAT Number" value={contact.vat_number} />
                <Field label="Entity Type" value={contact.entity_type?.replace(/_/g, ' ')} />
                <Field label="Registered Office" value={contact.registered_office_address} />
              </div>
            </div>
          )}

          {(contact.address_line1 || contact.city || contact.postcode) && (
            <div className="pt-6 border-t border-gray-100">
              <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-3">Address</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Address Line 1" value={contact.address_line1} />
                <Field label="Address Line 2" value={contact.address_line2} />
                <Field label="City" value={contact.city} />
                <Field label="Postcode" value={contact.postcode} />
                <Field label="Country" value={contact.country} />
              </div>
            </div>
          )}

          {(contact.bank_account_name || contact.bank_sort_code || contact.bank_iban) && (
            <div className="pt-6 border-t border-gray-100">
              <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-3">Bank Details</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Account Name" value={contact.bank_account_name} />
                <Field label="Sort Code" value={contact.bank_sort_code} />
                <Field label="Account Number" value={contact.bank_account_number} />
                <Field label="IBAN" value={contact.bank_iban} />
              </div>
            </div>
          )}

          {contact.notes && (
            <div className="pt-6 border-t border-gray-100">
              <p className="text-xs font-semibold text-brand-dark uppercase tracking-wider mb-2">Notes</p>
              <p className="text-sm text-gray-600">{contact.notes}</p>
            </div>
          )}
        </div>
      </div>

      <TransactionAuditTrail entityType="contact" entityId={contactId} />
    </div>
  )
}
