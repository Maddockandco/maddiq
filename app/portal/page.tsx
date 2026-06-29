'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PortalPage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      // Wait for session to be ready
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setAuthChecked(true)
        setLoading(false)
        window.location.href = '/portal/login'
        return
      }

      const { data: portalUser } = await supabase
        .from('client_portal_users')
        .select('client_id, status')
        .eq('user_id', session.user.id)
        .single()

      if (!portalUser || portalUser.status !== 'active') {
        setAuthChecked(true)
        setLoading(false)
        window.location.href = '/portal/login'
        return
      }

      setAuthChecked(true)

      const { data: clientData } = await supabase
        .from('clients')
        .select('name, email')
        .eq('id', portalUser.client_id)
        .single()

      if (clientData) setClient(clientData)

      const { data: docs } = await supabase
        .from('documents')
        .select('id, name, category, file_url, file_size, created_at')
        .eq('client_id', portalUser.client_id)
        .eq('shared_with_client', true)
        .order('created_at', { ascending: false })

      if (docs) setDocuments(docs)
      setLoading(false)
    }
    fetchData()
  }, [])

  async function handleDownload(filePath: string, fileName: string) {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 60 * 60)

      if (error || !data?.signedUrl) {
        alert('Could not generate download link. Please try again.')
        return
      }

      const link = document.createElement('a')
      link.href = data.signedUrl
      link.download = fileName
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (err) {
      alert('Download failed. Please try again.')
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/portal/login'
  }

  if (loading) return (
    <div className="text-center py-12">
      <p className="text-gray-500 text-sm">Loading your portal...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="bg-brand-dark rounded-2xl p-6 text-white flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{client?.name || 'Welcome'}</h2>
          <p className="text-white/60 text-sm mt-1">Your secure document portal</p>
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs text-white/60 hover:text-white transition px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40"
        >
          Sign out
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-6">
          Your Documents
        </h3>

        {documents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No documents have been shared with you yet</p>
            <p className="text-gray-400 text-xs mt-1">
              Your accountant will share documents here when they are ready
            </p>
          </div>
        ) : (
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
                      {doc.category.replace(/_/g, ' ')} · {new Date(doc.created_at).toLocaleDateString('en-GB')}
                      {doc.file_size && ` · ${(doc.file_size / 1024).toFixed(1)} KB`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(doc.file_url, doc.name)}
                  className="text-xs px-4 py-2 rounded-lg font-medium bg-brand-dark text-white hover:bg-opacity-90 transition flex items-center gap-2"
                >
                  ⬇️ Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
