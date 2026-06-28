'use client'

import { useState } from 'react'
import ClientDetail from '@/components/clients/ClientDetail'
import ClientTaxInfo from '@/components/clients/ClientTaxInfo'
import ClientContacts from '@/components/clients/ClientContacts'
import ClientDocumentList from '@/components/documents/ClientDocumentList'
import DocumentUpload from '@/components/documents/DocumentUpload'

const tabs = [
  { id: 'overview', label: '📋 Overview' },
  { id: 'tax', label: '💰 Tax Info' },
  { id: 'directors', label: '👤 Directors' },
  { id: 'documents', label: '📄 Documents' },
  { id: 'notes', label: '📝 Notes' },
]

export default function ClientTabs({ clientId }: { clientId: string }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [docRefresh, setDocRefresh] = useState(0)

  return (
    <div>
      {/* Tab Bar */}
      <div className="flex gap-2 mb-6 bg-white rounded-2xl p-2 border border-gray-200 shadow-sm overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-brand-dark text-white'
                : 'text-gray-500 hover:text-brand-dark hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <ClientDetail clientId={clientId} />
      )}

      {activeTab === 'tax' && (
        <ClientTaxInfo clientId={clientId} />
      )}

      {activeTab === 'directors' && (
        <ClientContacts clientId={clientId} />
      )}

      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <DocumentUpload
              clientId={clientId}
              onUploadComplete={() => setDocRefresh(r => r + 1)}
            />
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">
                Uploaded Documents
              </h3>
              <ClientDocumentList clientId={clientId} refresh={docRefresh} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">Notes coming soon</p>
        </div>
      )}
    </div>
  )
}
