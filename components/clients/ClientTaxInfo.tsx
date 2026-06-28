'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ClientTaxInfo({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchClient() {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()
      if (data) setClient(data)
      setLoading(false)
    }
    fetchClient()
  }, [clientId])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
        <p className="text-gray-500 text-sm">Loading tax info...</p>
      </div>
    )
  }

  const InfoRow = ({ label, value }: { label: string; value: any }) => (
    <div className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-brand-dark">{value || '—'}</span>
    </div>
  )

  const BoolRow = ({ label, value }: { label: string; value: boolean }) => (
    <div className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        {value ? 'Yes' : 'No'}
      </span>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link
          href={`/clients/${clientId}/tax`}
          className="text-xs px-3 py-1.5 rounded-lg bg-brand-dark text-white hover:bg-opacity-90 transition"
        >
          ✏️ Edit tax info
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">🏢 Companies House</h3>
          <InfoRow label="Company Number" value={client.company_number} />
          <InfoRow label="CH Authentication Code" value={client.ch_authentication_code} />
          <InfoRow label="SIC Code" value={client.sic_code} />
          <InfoRow label="Incorporation Date" value={client.incorporation_date} />
          <InfoRow label="Accounting Reference Date" value={client.accounting_reference_date} />
          <InfoRow label="Registered Address" value={client.registered_address} />
          <InfoRow label="Trading Address" value={client.trading_address} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">💼 Corporation Tax</h3>
          <InfoRow label="CT UTR" value={client.ct_utr} />
          <InfoRow label="CT Payment Reference" value={client.ct_payment_reference} />
          <InfoRow label="Year End Date" value={client.year_end_date} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">🧾 VAT</h3>
          <BoolRow label="VAT Registered" value={client.vat_registered} />
          <InfoRow label="VAT Number" value={client.vat_number} />
          <InfoRow label="VAT Scheme" value={client.vat_scheme} />
          <InfoRow label="VAT Registration Date" value={client.vat_registration_date} />
          <InfoRow label="VAT Quarter End" value={client.vat_quarter_end ? `Month ${client.vat_quarter_end}` : null} />
          <InfoRow label="Flat Rate %" value={client.vat_flat_rate_percentage ? `${client.vat_flat_rate_percentage}%` : null} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">👥 PAYE & Payroll</h3>
          <InfoRow label="PAYE Reference" value={client.paye_reference} />
          <InfoRow label="Accounts Office Reference" value={client.accounts_office_reference} />
          <InfoRow label="Number of Employees" value={client.number_of_employees} />
          <InfoRow label="Payroll Frequency" value={client.payroll_frequency} />
          <BoolRow label="Auto Enrolment" value={client.auto_enrolment} />
          <InfoRow label="Pension Provider" value={client.pension_provider} />
          <InfoRow label="Pension Staging Date" value={client.pension_staging_date} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">🏗️ CIS</h3>
          <BoolRow label="CIS Registered" value={client.cis_registered} />
          <InfoRow label="CIS UTR" value={client.cis_utr} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">🏦 Banking</h3>
          <InfoRow label="Bank Name" value={client.bank_name} />
          <InfoRow label="Sort Code" value={client.bank_sort_code} />
          <InfoRow label="Account Number" value={client.bank_account_number} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">💳 Billing</h3>
          <InfoRow label="Monthly Fee" value={client.monthly_fee ? `£${client.monthly_fee}` : null} />
          <InfoRow label="Hourly Rate" value={client.hourly_rate ? `£${client.hourly_rate}/hr` : null} />
          <InfoRow label="Billing Day" value={client.billing_day ? `${client.billing_day}th of month` : null} />
          <InfoRow label="Payment Method" value={client.payment_method} />
        </div>

      </div>
    </div>
  )
}
