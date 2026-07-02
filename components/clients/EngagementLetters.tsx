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

  useEffect(() => {
    fetchData()
  }, [clientId])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user.id)
      .single()
    if (!firmUser) return

    const lettersResult = await supabase
      .from('engagement_letters')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    const templatesResult = await supabase
      .from('engagement_letter_templates')
      .select('id, name, content, is_default')
      .eq('firm_id', firmUser.firm_id)
      .order('is_default', { ascending: false })

    if (lettersResult.data) setLetters(lettersResult.data)
    if (templatesResult.data) {
      setTemplates(templatesResult.data)
      const def = templatesResult.data.find(t => t.is_default)
      if (def) {
        setSelectedTemplate(def.id)
      } else if (templatesResult.data.length > 0) {
        setSelectedTemplate(templatesResult.data[0].id)
      }
    }
    setLoading(false)
  }

  function formatType(type: string) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  async function buildLetterContent(templateContent: string) {
    const { data: { user } } = await supabase.auth.getUser()

    const firmUserResult = await supabase
      .from('firm_users')
      .select('firm_id, firms(name)')
      .eq('user_id', user!.id)
      .single()

    const clientResult = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single()

    const engagementsResult = await supabase
      .from('engagements')
      .select('type, fee_amount, frequency')
      .eq('client_id', clientId)
      .eq('status', 'active')

    const firmName = (firmUserResult.data?.firms as any)?.name || 'Our Firm'
    const clientName = clientResult.data?.name || 'Client'
    const engagements = engagementsResult.data

    let servicesList = '- Services as agreed'
    let feeSummary = 'Fees as agreed separately'

    if (engagements && engagements.length > 0) {
      servicesList = engagements.map((e) => '- ' + formatType(e.type)).join('\n')
      feeSummary = engagements.map((e) => {
        const fee = parseFloat(e.fee_amount).toFixed(2)
        const freq = e.frequency.replace(/_/g, ' ')
        return formatType(e.type) + ': £' + fee + ' (' + freq + ')'
      }).join('\n')
    }

    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    let result = templateContent
    result = result.replaceAll('{client_name}', clientName)
    result = result.replaceAll('{firm_name}', firmName)
    result = result.replaceAll('{services}', servicesList)
    result = result.replaceAll('{fee_summary}', feeSummary)
    result = result.replaceAll('{date}', today)

    return result
  }

  async function handleGenerate() {
    if (!selectedTemplate) return
    setSaving(true)
    setError('')

    const template = templates.find((t) => t.id === selectedTemplate)
    if (!template) {
      setSaving(false)
      return
    }

    const builtContent = await buildLetterContent(template.content)
    setPreviewing({ template_id: selectedTemplate, isNew: true })
    setEditedContent(builtContent)
    setCreating(false)
    setSaving(false)
  }

  async function handleSaveDraft() {
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const firmUserResult = await supabase
      .from('firm_users')
      .select('firm_id, id')
      .eq('user_id', user!.id)
      .single()

    if (!firmUserResult.data) {
      setError('Could not find your firm')
      setSaving(false)
      return
    }

    const firmUser = firmUserResult.data

    if (previewing.isNew) {
      const insertResult = await supabase.from('engagement_letters').insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        template_id: previewing.template_id,
        content: editedContent,
        status: 'draft',
        created_by: firmUser.id,
      })
      if (insertResult.error) {
        setError(insertResult.error.message)
        setSaving(false)
        return
      }
    } else {
      const updateResult = await supabase
        .from('engagement_letters')
        .update({ content: editedContent, updated_at: new Date().toISOString() })
        .eq('id', previewing.id)
      if (updateResult.error) {
        setError(updateResult.error.message)
        setSaving(false)
        return
      }
    }

    setPreviewing(null)
    fetchData()
    setSaving(false)
  }

  async function handleSend(letterId:
