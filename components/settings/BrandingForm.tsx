'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BrandingForm() {
  const [firmId, setFirmId] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [brandColor, setBrandColor] = useState('#343b46')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchFirm() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: firmUser } = await supabase
        .from('firm_users')
        .select('firm_id, firms(id, logo_url, brand_color)')
        .eq('user_id', user.id)
        .single()

      if (firmUser?.firms) {
        const firm = firmUser.firms as any
        setFirmId(firm.id)
        setLogoUrl(firm.logo_url || '')
        setBrandColor(firm.brand_color || '#343b46')
      }
      setLoading(false)
    }
    fetchFirm()
  }, [])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !firmId) return

    setUploading(true)
    setError('')

    const fileExt = file.name.split('.').pop()
    const filePath = `${firmId}/logo.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('firm-branding')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('firm-branding')
      .getPublicUrl(filePath)

    setLogoUrl(urlData.publicUrl)
    setUploading(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess(false)

    const { error: updateError } = await supabase
      .from('firms')
      .update({ logo_url: logoUrl || null, brand_color: brandColor })
      .eq('id', firmId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
      <p className="text-gray-500 text-sm">Loading branding...</p>
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6">
      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-3">Branding saved!</div>}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
        <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Firm Branding</h2>
        <p className="text-xs text-gray-500 -mt-4">
          Used on the cover pages of quotes, proposals and engagement letters sent to clients.
        </p>

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-2">Firm logo</label>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Firm logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-gray-400">No logo</span>
              )}
            </div>
            <div>
              <label className="cursor-pointer inline-block bg-gray-100 text-brand-dark font-medium px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition">
                {uploading ? 'Uploading...' : 'Upload logo'}
                <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading} className="hidden" />
              </label>
              <p className="text-xs text-gray-400 mt-2">PNG or JPG, square works best</p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-2">Brand accent colour</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-14 h-10 rounded-lg border border-gray-200 cursor-pointer"
            />
            <input
              type="text"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold font-mono"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Used for cover page backgrounds and accents on client-facing documents</p>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-brand-dark text-white font-semibold py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm">
          {saving ? 'Saving...' : 'Save branding'}
        </button>
      </div>
    </div>
  )
}
