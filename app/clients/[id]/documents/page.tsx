'use client'

import { useState } from 'react'
import Link from 'next/link'
import DocumentUpload from '@/components/documents/DocumentUpload'
import ClientDocumentList from '@/components/documents/ClientDocumentList'

export default function ClientDocumentsPage({ params }: { params: { id: string } }) {
  const [refresh, setRefresh] = useState(0)

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/clients/${params.id}`} className="text-gray-400 hover:text-brand-dark transition text-sm">
          ← Back to client
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-brand-dark mb-8">Documents</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload panel */}
        <div className="lg:col-span-1">
          <DocumentUpload
            clientId={params.id}
            onUploadComplete={() => setRefresh(r => r + 1)}
          />
        </div>

        {/* Document list */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">
              Uploaded Documents
            </h3>
            <ClientDocumentList clientId={params.id} refresh={refresh} />
          </div>
        </div>
      </div>
    </div>
  )
}
