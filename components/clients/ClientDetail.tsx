'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import PortalInvite from '@/components/clients/PortalInvite'
import AssignClient from '@/components/clients/AssignClient'
import { useRole } from '@/hooks/useRole'

type Client = {
  id: string
  name: string
  type: string
  status: string
  email: string | null
  phone: string | null
  industry: string | null
  company_number: string | null
  registered_address: string | null
  trading_address: string | null
  vat_registered: boolean
  vat_number: string | null
  year_end_date: string | null
  notes: string | null
  assigned_to: string | null
  date_of_birth: string | null
  national_insurance_number: string | null
  personal_utr: string | null
  sa_status: string | null
  student_loan: boolean | null
  student_loan_plan: string | null
  marriage_allowance: boolean | null
  child_benefit: boolean | null
  foreign_income: boolean | null
  partnership_type: string | null
  partnership_utr: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  postcode: string | null
  country: string | null
}

export default function ClientDetail({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null)
  const [connectedCompanies, setConnectedCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => {
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
          .select('role, client_id, national_insurance_number, personal_utr, date_of_birth, clients!client_id(id, name, type)')
          .eq('linked_client_id', clientId)
        if (links) setConnectedCompanies(links)
      }

      setLoading(false)
    }
    fetchClient()
  }, [clientId])

  if (loading) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading client...</p>
    </div>
  )

  if (!client) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Client not found</p>
    </div>
  )

  // For individuals created via "also create as client" from a director record,
  // personal fields may live on the linked client_contacts row rather than this
  // client's own row. Fall back to that if the client's own field is empty.
  const linkedRecord = connectedCompanies[0]
  const niNumber = client.national_insurance_number || linkedRecord?.national_insurance_number
  const personalUtr = client.personal_utr || linkedRecord?.personal_utr
  const dobDisplay = client.date_of_birth || linkedRecord?.date_of_birth

  return (
    <div className="space-y-6">
      {client.type === 'individual' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Email</p>
            <p className="text-brand-dark text-sm mt-1">{client.email || '—'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Phone</p>
            <p className="text-brand-dark text-sm mt-1">{client.phone || '—'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Date of Birth</p>
            <p className="text-brand-dark text-sm mt-1">{dobDisplay ? new Date(dobDisplay).toLocaleDateString('en-GB') : '—'}</p>
          </div>
        </div>
      )}
      {client.type === 'company' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Email</p>
            <p className="text-brand-dark text-sm mt-1">{client.email || '—'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Phone</p>
            <p className="text-brand-dark text-sm mt-1">{client.phone || '—'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Industry</p>
            <p className="text-brand-dark text-sm mt-1">{client.industry || '—'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">VAT Registered</p>
            <p className="text-brand-dark text-sm mt-1">{client.vat_registered ? 'Yes' : 'No'}</p>
          </div>
        </div>
      )}

      {client.type === 'individual' && connectedCompanies.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">Connected Companies</h3>
          <div className="space-y-2">
            {connectedCompanies.map((link, i) => (
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
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {client.type === 'company' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">Company Info</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Companies House No.</span>
                <span className="text-sm text-brand-dark font-medium">{client.company_number || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">VAT Number</span>
                <span className="text-sm text-brand-dark font-medium">{client.vat_number || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Year End</span>
                <span className="text-sm text-brand-dark font-medium">{client.year_end_date || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Registered Office</span>
                <span className="text-sm text-brand-dark font-medium text-right">{client.registered_address || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Trading Address</span>
                <span className="text-sm text-brand-dark font-medium text-right">{client.trading_address || '—'}</span>
              </div>
            </div>
          </div>
        )}

        {client.type === 'individual' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">Personal Info</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">NI Number</span>
                <span className="text-sm text-brand-dark font-medium">{niNumber || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Personal UTR</span>
                <span className="text-sm text-brand-dark font-medium">{personalUtr || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">SA Status</span>
                <span className="text-sm text-brand-dark font-medium">{client.sa_status || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Home Address</span>
                <span className="text-sm text-brand-dark font-medium text-right">
                  {client.address_line1 ? (
                    <>
                      {client.address_line1}
                      {client.address_line2 && <>, {client.address_line2}</>}
                      {client.city && <>, {client.city}</>}
                      {client.postcode && <>, {client.postcode}</>}
                    </>
                  ) : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {client.type === 'partnership' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">Partnership Info</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Partnership Type</span>
                <span className="text-sm text-brand-dark font-medium capitalize">{client.partnership_type || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Partnership UTR</span>
                <span className="text-sm text-brand-dark font-medium">{client.partnership_utr || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Registered Office</span>
                <span className="text-sm text-brand-dark font-medium text-right">{client.registered_address || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Trading Address</span>
                <span className="text-sm text-brand-dark font-medium text-right">{client.trading_address || '—'}</span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {can.createTasks && (
              <a href={`/clients/${client.id}/tasks`} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-50 hover:bg-brand-light text-sm font-medium text-brand-dark transition">
                Add Task
              </a>
            )}
            {can.uploadDocuments && (
              <a href={`/clients/${client.id}/documents`} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-50 hover:bg-brand-light text-sm font-medium text-brand-dark transition">
                Upload Document
              </a>
            )}
            {can.addNotes && (
              <a href={`/clients/${client.id}/notes`} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-50 hover:bg-brand-light text-sm font-medium text-brand-dark transition">
                Add Note
              </a>
            )}
            {can.manageEngagements && (
              <a href={`/clients/${client.id}/engagements`} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-50 hover:bg-brand-light text-sm font-medium text-brand-dark transition">
                Add Engagement
              </a>
            )}
            {can.inviteToPortal && (
              <PortalInvite clientId={client.id} clientName={client.name} />
            )}
          </div>
        </div>
      </div>

      {can.manageTeam && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">
            Assigned Team Members
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Tick team members to give them access to this client
          </p>
          <AssignClient clientId={client.id} />
        </div>
      )}

      {client.notes && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-3">Notes</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{client.notes}</p>
        </div>
      )}
    </div>
  )
}
