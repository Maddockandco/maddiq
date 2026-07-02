'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'

const statusStyles: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
}

export default function EngagementLetters({ clientId }: { clientId: string }) {
  const [letters, setLetters] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [previewing, setPreviewing] = useState<any>(null)
  const [editedContent, setEditedContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { can } = useRole()
  const supabase = createClient()

  useEffect(() => { fetchData() }, [clientId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user.id)
      .single()
    if (!firmUser) return

    const [{ data: lettersData }, { data: templatesData }] = await Promise.all([
      supabase
        .from('engagement_letters')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
      supabase
        .from('engagement_letter_templates')
        .select('id, name, content, is_default')
        .eq('firm_id', firmUser.firm_id)
        .order('is_default', { ascending: false }),
    ])

    if (lettersData) setLetters(lettersData)
    if (templatesData) {
      setTemplates(templatesData)
      const def = templatesData.find(t => t.is_default)
      if (def) setSelectedTemplate(def.id)
      else if (templatesData.length > 0) setSelectedTemplate(templatesData[0].id)
    }
    setLoading(false)
  }

  async function buildLetterContent(templateContent: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id, firms(name)')
      .eq('user_id', user!.id)
      .single()

    const { data: client } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single()

    const { data: engagements } = await supabase
      .from('engagements')
      .select('type, fee_amount, frequency')
      .eq('client_id', clientId)
      .eq('status', 'active')

    const firmName = (firmUser?.firms as any)?.name || 'Our Firm'
    const clientName = client?.name || 'Client'

    const formatType = (type: string) => type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

    const servicesList = engagements && engagements.length > 0
      ? engagements.map(e => `- ${formatType(e.type)}`).join('\n')
      : '- Services as agreed'

    const feeSummary = engagements && engagements.length > 0
      ? engagements.map(e => `${formatType(e.type)}: £${parseFloat(e.fee_amount).toFixed(2)} (${e.frequency.replace(/_/g, ' ')})`).join('\n')
      : 'Fees as agreed separately'

    const today = new
