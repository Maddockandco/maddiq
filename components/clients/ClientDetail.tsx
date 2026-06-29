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
  vat_registered: boolean
  vat_number: string | null
  year_end_date: string | null
  notes: string | null
  assigned_to: string | null
}

export default function ClientDetail({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null)
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

  return (
    <div className="space-y-6">
      <div className="bg-brand-dark rounded-2xl p-8 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{client.name}</h2>
            <p className="text-white/60 text-sm mt-1 capitalize">{client.type}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize ${
              client.status === 'active' ? 'bg-green-400/20 text-green-300' :
              client.status === 'prospect' ? 'bg-blue-400/20 text-blue-300' :
              client.status === 'onboarding' ? 'bg-amber-400/20 text-amber-300' :
              'bg-gray-400/20 text-gray-300'
            }`}>
              {client.status}
            </span>
            {can.editClientDetails && (
              <Link
                href={`/clients/${client.id}/edit`}
                className="px-4 py-1.5 rounded-full text-xs font-semibold bg-brand-gold text-brand-dark hover:bg-opacity-90 transition"
              >
                Edit
              </Link>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider">Email</p>
            <p className="text-white text-sm mt-1">{client.email || '—'}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider">Phone</p>
            <p className="text-white text-sm mt-1">{client.phone || '—'}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider">Industry</p>
            <p className="text-white text-sm mt-1">{client.industry || '—'}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider">VAT Registered</p>
            <p className="text-white text-sm mt-1">{client.vat_registered ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </div>
        </div>

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

      {/* Team Assignment — only visible to owners and managers */}
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
