'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  clientId: string
  refresh?: number
}

export default function ClientDocumentList({ clientId, refresh }: Props) {
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchDocuments() {
      const { data } = await supabase
        .from('documents')
        .select('id, name, category, file_url, file_size, shared_with_client, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (data) setDocuments(data)
      setLoading(false)
    }
    fetchDocuments()
  }, [clientId, refresh])

  async function handleDownload(filePath: string, fileName: string) {
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 60)

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  async function handleShare(docId: string, currentlyShared: boolean) {
    await supabase
      .from('documents')
      .update({ shared_with_client: !currentlyShared })
      .eq('id', docId)

    setDocuments(docs =>
      docs.map(d => d.id === docId ? { ...d, shared_with_client: !currentlyShared } : d)
    )
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading documents...</p>
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500">No documents uploaded yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-brand-gold transition"
        >
          <div className="flex items-center gap-3">
            <div className="text-2xl">
              {doc.name.endsWith('.pdf') ? '📄' :
               doc.name.endsWith('.xlsx') || doc.name.endsWith('.xls') ? '📊' :
               doc.name.endsWith('.docx') || doc.name.endsWith('.doc') ? '📝' :
               '📎'}
            </div>
            <div>
              <p className="text-sm font-medium text-brand-dark">{doc.name}</p>
              <p className="text-xs text-gray-500 capitalize mt-0.5">
                {doc.category.replace(/_/g, ' ')} •{' '}
                {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''} •{' '}
                {new Date(doc.created_at).toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleShare(doc.id, doc.shared_with_client)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                doc.shared_with_client
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {doc.shared_with_client ? '✅ Shared' : 'Share'}
            </button>
            <button
              onClick={() => handleDownload(doc.file_url, doc.name)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-brand-dark text-white hover:bg-opacity-90 transition"
            >
              Download
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
