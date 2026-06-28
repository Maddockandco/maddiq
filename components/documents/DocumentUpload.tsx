'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  clientId: string
  onUploadComplete?: () => void
}

export default function DocumentUpload({ clientId, onUploadComplete }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState('other')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  async function handleUpload() {
    if (!file) {
      setError('Please select a file')
      return
    }

    setUploading(true)
    setError('')
    setSuccess(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated')
      setUploading(false)
      return
    }

    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id, id')
      .eq('user_id', user.id)
      .single()

    if (!firmUser) {
      setError('Could not find your firm')
      setUploading(false)
      return
    }

    // Upload file to Supabase Storage
    const filePath = `${firmUser.firm_id}/${clientId}/${category}/${Date.now()}_${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file)

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    // Save document record to database
    const { error: dbError } = await supabase
      .from('documents')
      .insert({
        client_id: clientId,
        firm_id: firmUser.firm_id,
        name: file.name,
        category,
        file_url: filePath,
        file_size: file.size,
        uploaded_by: firmUser.id,
        shared_with_client: false,
      })

    if (dbError) {
      setError(dbError.message)
      setUploading(false)
      return
    }

    setSuccess(true)
    setFile(null)
    setCategory('other')
    setUploading(false)
    if (onUploadComplete) onUploadComplete()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Upload Document</h3>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-3">Document uploaded successfully!</div>
      )}

      {/* File picker */}
      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Select file</label>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
        />
        {file && (
          <p className="text-xs text-gray-500 mt-1">
            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        >
          <option value="accounts">Accounts</option>
          <option value="tax_return">Tax Return</option>
          <option value="engagement_letter">Engagement Letter</option>
          <option value="id_verification">ID Verification</option>
          <option value="correspondence">Correspondence</option>
          <option value="other">Other</option>
        </select>
      </div>

      <button
        onClick={handleUpload}
        disabled={uploading || !file}
        className="w-full bg-brand-dark text-white font-semibold py-2.5 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm"
      >
        {uploading ? 'Uploading...' : 'Upload document'}
      </button>
    </div>
  )
}
