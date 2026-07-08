'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { InfoRow, BoolRow, TaxCard } from '@/components/clients/ClientTaxInfoCards'
import RefreshFromCH from '@/components/clients/RefreshFromCH'
import { useRole } from '@/hooks/useRole'

export default function ClientTaxInfo({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<any>(null)
  const [connectedCompanies, setConnectedCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchClient() }, [clientId])

  async function fetchClient() {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()
    if (data) setClient(data)

    if (data?.type === 'individual') {
      const { data: links } = await supabase
        .from('client_contacts')
        .select('role, national_insurance_number, personal_utr, date_of_birth, appointment_date, client_id, clients!client_id(id, name)')
        .eq('linked_client_id', clientId)
      if (links) setConnectedCompanies(links)
    }

    setLoading(false)
  }

  if (loading) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading tax info...</p>
    </div>
  )

  const canEdit = can.editTaxInfo || can.editPayrollInfo || can.editCIS

  // For individuals created via "also create as client" from a director record,
  // NI number / personal UTR may live on the linked client_contacts row rather than
  // this client's own row. Fall back to that if the client's own field is empty.
  const linkedRecord = connectedCompanies[0]
  const niNumber = client.national_insurance_number || linkedRecord?.national_insurance_number
  const personalUtr = client.personal_utr || linkedRecord?.personal_utr
  const dob = client.date_of_birth || linkedRecord?.date_of_birth

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {client.company_number && can.refreshFromCH && (
            <RefreshFromCH
              clientId={clientId}
              companyNumber={client.company_number}
              onRefreshed={fetchClient}
            />
          )}
        </div>
        {canEdit && (
          <Link
            href={`/clients/${clientId}/tax`}
            className="text-xs px-3 py-1.5 rounded-lg bg-brand-dark text-white hover:bg-opacity-90 transition"
          >
            Edit tax info
          </Link>
        )}
      </div>

      {client.type === 'individual' && connectedCompanies.length > 0 && (
        <TaxCard title="Connected Companies">
          <div className="space-y-2">
            {connectedCompanies.map((link: any, i: number) => (
              <Link
                key={i}
                href={`/clients/${link.client_id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-brand-light transition"
              >
                <div>
                  <p className="text-sm font-medium text-brand-dark">{link.clients?.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{link.role}</p>
                </div>
                <span className="text-xs text-brand-dark">View →</span>
              </Link>
            ))}
          </div>
        </TaxCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {client.type === 'individual' && (
          <>
            <TaxCard title="Personal Tax">
              <InfoRow label="Date of Birth" value={dob ? new Date(dob).toLocaleDateString('en-GB') : null} />
              <InfoRow label="NI Number" value={niNumber} />
              <InfoRow label="Personal UTR" value={personalUtr} />
              <InfoRow label="SA Status" value={client.sa_status} />
            </TaxCard>

            <TaxCard title="Self Assessment Details">
              <BoolRow label="Student Loan" value={client.student_loan} />
              <InfoRow label="Student Loan Plan" value={client.student_loan_plan} />
              <BoolRow label="Marriage Allowance" value={client.marriage_allowance} />
              <BoolRow label="Child Benefit" value={client.child_benefit} />
              <BoolRow label="Foreign Income" value={client.foreign_income} />
            </TaxCard>
          </>
        )}

        {client.type === 'partnership' && (
          <TaxCard title="Partnership">
            <InfoRow label="Partnership Type" value={client.partnership_type} />
            <InfoRow label="Partnership UTR" value={client.partnership_utr} />
          </TaxCard>
        )}

        {client.type === 'company' && (
          <>
            <TaxCard title="Companies House">
              <InfoRow label="Company Number" value={client.company_number} />
              <InfoRow label="CH Authentication Code" value={client.ch_authentication_code} />
              <InfoRow label="SIC Code" value={client.sic_code} />
              <InfoRow label="Incorporation Date" value={client.incorporation_date ? new Date(client.incorporation_date).toLocaleDateString('en-GB') : null} />
              <InfoRow label="Accounting Reference Date" value={client.accounting_reference_date} />
              <InfoRow label="Next Accounts Due" value={client.next_accounts_due ? new Date(client.next_accounts_due).toLocaleDateString('en-GB') : null} />
              <InfoRow label="Next Confirmation Statement Due" value={client.next_confirmation_due ? new Date(client.next_confirmation_due).toLocaleDateString('en-GB') : null} />
              <InfoRow label="Registered Address" value={client.registered_address} />
              <InfoRow label="Trading Address" value={client.trading_address} />
            </TaxCard>

            <TaxCard title="Corporation Tax">
              <InfoRow label="CT UTR" value={client.ct_utr} />
              <InfoRow label="CT Payment Reference" value={client.ct_payment_reference} />
              <InfoRow label="Year End Date" value={client.year_end_date ? new Date(client.year_end_date).toLocaleDateString('en-GB') : null} />
            </TaxCard>

            <TaxCard title="VAT">
              <BoolRow label="VAT Registered" value={client.vat_registered} />
              <InfoRow label="VAT Number" value={client.vat_number} />
              <InfoRow label="VAT Scheme" value={client.vat_scheme} />
              <InfoRow label="VAT Registration Date" value={client.vat_registration_date} />
              <InfoRow label="VAT Quarter End" value={client.vat_quarter_end ? `Month ${client.vat_quarter_end}` : null} />
              <InfoRow label="Flat Rate %" value={client.vat_flat_rate_percentage ? `${client.vat_flat_rate_percentage}%` : null} />
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
          </>
        )}

        {['company', 'partnership'].includes(client.type) && (
          <TaxCard title="PAYE & Payroll">
            <InfoRow label="PAYE Reference" value={client.paye_reference} />
            <InfoRow label="Accounts Office Reference" value={client.accounts_office_reference} />
            <InfoRow label="Number of Employees" value={client.number_of_employees} />
            <InfoRow label="Payroll Frequency" value={client.payroll_frequency} />
            <BoolRow label="Auto Enrolment" value={client.auto_enrolment} />
            <InfoRow label="Pension Provider" value={client.pension_provider} />
            <InfoRow label="Pension Staging Date" value={client.pension_staging_date} />
          </TaxCard>
        )}

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
