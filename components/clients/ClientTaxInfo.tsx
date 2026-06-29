'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { InfoRow, BoolRow, TaxCard } from '@/components/clients/ClientTaxInfoCards'
import RefreshFromCH from '@/components/clients/RefreshFromCH'

export default function ClientTaxInfo({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchClient()
  }, [clientId])

  async function fetchClient() {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()
    if (data) setClient(data)
    setLoading(false)
  }

  if (loading) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading tax info...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {client.company_number && (
            <RefreshFromCH
              clientId={clientId}
              companyNumber={client.company_number}
              onRefreshed={fetchClient}
            />
          )}
        </div>
        <Link
          href={`/clients/${clientId}/tax`}
          className="text-xs px-3 py-1.5 rounded-lg bg-brand-dark text-white hover:bg-opacity-90 transition"
        >
          Edit tax info
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <TaxCard title="Companies House">
          <InfoRow label="Company Number" value={client.company_number} />
          <InfoRow label="CH Authentication Code" value={client.ch_authentication_code} />
          <InfoRow label="SIC Code" value={client.sic_code} />
          <InfoRow label="Incorporation Date" value={client.incorporation_date
            ? new Date(client.incorporation_date).toLocaleDateString('en-GB')
            : null} />
          <InfoRow label="Accounting Reference Date" value={client.accounting_reference_date} />
          <InfoRow label="Next Accounts Due" value={client.next_accounts_due
            ? new Date(client.next_accounts_due).toLocaleDateString('en-GB')
            : null} />
          <InfoRow label="Next Confirmation Due" value={client.next_confirmation_due
            ? new Date(client.next_confirmation_due).toLocaleDateString('en-GB')
            : null} />
          <InfoRow label="Registered Address" value={client.registered_address} />
          <InfoRow label="Trading Address" value={client.trading_address} />
        </TaxCard>

        <TaxCard title="Corporation Tax">
          <InfoRow label="CT UTR" value={client.ct_utr} />
          <InfoRow label="CT Payment Reference" value={client.ct_payment_reference} />
          <InfoRow label="Year End Date" value={client.year_end_date
            ? new Date(client.year_end_date).toLocaleDateString('en-GB')
            : null} />
        </TaxCard>

        <TaxCard title="VAT">
          <BoolRow label="VAT Registered" value={client.vat_registered} />
          <InfoRow label="VAT Number" value={client.vat_number} />
          <InfoRow label="VAT Scheme" value={client.vat_scheme} />
          <InfoRow label="VAT Registration Date" value={client.vat_registration_date} />
          <InfoRow label="VAT Quarter End" value={client.vat_quarter_end ? `Month ${client.vat_quarter_end}` : null} />
          <InfoRow label="Flat Rate %" value={client.vat_flat_rate_percentage ? `${client.vat_flat_rate_percentage}%` : null} />
        </TaxCard>

        <TaxCard title="PAYE & Payroll">
          <InfoRow label="PAYE Reference" value={client.paye_reference} />
          <InfoRow label="Accounts Office Reference" value={client.accounts_office_reference} />
          <InfoRow label="Number of Employees" value={client.number_of_employees} />
          <InfoRow label="Payroll Frequency" value={client.payroll_frequency} />
          <BoolRow label="Auto Enrolment" value={client.auto_enrolment} />
          <InfoRow label="Pension Provider" value={client.pension_provider} />
          <InfoRow label="Pension Staging Date" value={client.pension_staging_date} />
        </TaxCard>

        <TaxCard title="CIS">
          <BoolRow label="CIS Registered" value={client.cis_registered} />
          <InfoRow label="CIS Status" value={
            client.cis_status === 'contractor' ? 'Contractor' :
            client.cis_status === 'subcontractor' ? 'Subcontractor' :
            client.cis_status === 'both' ? 'Contractor & Subcontractor' : null
          } />
          <BoolRow label="Gross Payment Status" value={client.cis_gross_payment_status} />
          <InfoRow label="CIS Tax Rate" value={
            client.cis_tax_rate === 'standard' ? 'Standard (20%)' :
            client.cis_tax_rate === 'higher' ? 'Higher (30%)' :
            client.cis_tax_rate === 'gross' ? 'Gross (0%)' : null
          } />
          <InfoRow label="Verification Number" value={client.cis_verification_number} />
          <InfoRow label="Gross Payment Date" value={client.cis_gross_payment_date} />
          <InfoRow label="CIS UTR" value={client.cis_utr} />
        </TaxCard>

        <TaxCard title="Banking">
          <InfoRow label="Bank Name" value={client.bank_name} />
          <InfoRow label="Sort Code" value={client.bank_sort_code} />
          <InfoRow label="Account Number" value={client.bank_account_number} />
        </TaxCard>

        <TaxCard title="Billing">
          <InfoRow label="Monthly Fee" value={client.monthly_fee ? `£${client.monthly_fee}` : null} />
          <InfoRow label="Hourly Rate" value={client.hourly_rate ? `£${client.hourly_rate}/hr` : null} />
          <InfoRow label="Billing Day" value={client.billing_day ? `${client.billing_day}th of month` : null} />
          <InfoRow label="Payment Method" value={client.payment_method} />
        </TaxCard>

      </div>
    </div>
  )
}
