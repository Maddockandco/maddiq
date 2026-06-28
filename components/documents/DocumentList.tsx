'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DocumentTable from '@/components/documents/DocumentTable'

export default function DocumentList() {
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchDocuments() {
      const { data } = await supabase
        .from('documents')
        .select('id, name, category, shared_with_client, created_at, clients(name)')
        .order('created_at', { ascending: false })
      if (data) setDocuments(data)
      setLoading(false)
    }
    fetchDocuments()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
        <p className="text-gray-500 text-sm">Loading documents...</p>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
        <h2 className="text-lg font-semibold text-brand-dark mb-2">No documents yet</h2>
        <p className="text-gray-500 text-sm">Upload documents from a client page</p>
      </div>
    )
  }

  return <DocumentTable documents={documents} />
}
