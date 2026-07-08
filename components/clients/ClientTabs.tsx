'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import ClientDetail from '@/components/clients/ClientDetail'
import ClientTaxInfo from '@/components/clients/ClientTaxInfo'
import ClientContacts from '@/components/clients/ClientContacts'
import ClientNotes from '@/components/clients/ClientNotes'
import ClientEngagements from '@/components/engagements/ClientEngagements'
import ClientDeadlines from '@/components/clients/ClientDeadlines'
import EngagementLetters from '@/components/clients/EngagementLetters'
import ClientDocumentList from '@/components/documents/ClientDocumentList'
import DocumentUpload from '@/components/documents/DocumentUpload'
import AccountingHub from '@/components/accounting/AccountingHub'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'tax', label: 'Tax Info' },
  { id: 'directors', label: 'Directors' },
  { id: 'engagements', label: 'Engagements' },
  { id: 'letters', label: 'Engagement Letters' },
  { id: 'accounting', label: 'Accounting' },
  { id: 'deadlines', label: 'Deadlines' },
  { id: 'documents', label: 'Documents' },
  { id: 'notes', label: 'Notes' },
]

export default function ClientTabs({ clientId }: { clientId: string }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [docRefresh, setDocRefresh] = useState(0)
  const [client, setClient] = useState<{ id: string; name: string; type: string; status: string } | null>(null)
  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => {
    async function fetchClient() {
      const { data } = await supabase
        .from('clients')
        .select('id, name, type, status')
        .eq('id', clientId)
        .single()
      if (data) setClient(data)
    }
    fetchClient()
  }, [clientId])

  return (
    <div>
      {client && (
        <div className="bg-brand-dark rounded-2xl p-6 text-white mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{client.name}</h2>
              <p className="text-white/60 text-sm mt-0.5 capitalize">{client.type}</p>
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
        </div>
      )}

      <div className="flex gap-2 mb-6 bg-white rounded-2xl p-2 border border-gray-200 shadow-sm overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-brand-dark text-white' : 'text-gray-500 hover:text-brand-dark hover:bg-gray-50'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'overview' && <ClientDetail clientId={clientId} />}
      {activeTab === 'tax' && <ClientTaxInfo clientId={clientId} />}
      {activeTab === 'directors' && <ClientContacts clientId={clientId} />}
      {activeTab === 'engagements' && <ClientEngagements clientId={clientId} />}
      {activeTab === 'letters' && <EngagementLetters clientId={clientId} />}
      {activeTab === 'accounting' && <AccountingHub clientId={clientId} />}
      {activeTab === 'deadlines' && <ClientDeadlines clientId={clientId} />}
      {activeTab === 'notes' && <ClientNotes clientId={clientId} />}
      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <DocumentUpload clientId={clientId} onUploadComplete={() => setDocRefresh(r => r + 1)} />
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">Uploaded Documents</h3>
              <ClientDocumentList clientId={clientId} refresh={docRefresh} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
