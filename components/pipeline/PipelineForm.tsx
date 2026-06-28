'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PipelineForm() {
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState('referral')
  const [stage, setStage] = useState('new')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  async function handleSubmit() {
    setLoading(true)
    setError('')
    setSuccess(false)

    if (!name) {
      setError('Contact name is required')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user.id)
      .single()

    if (!firmUser) {
      setError('Could not find your firm')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('pipeline_leads')
      .insert({
        firm_id: firmUser.firm_id,
        name,
        company_name: companyName || null,
        email: email || null,
        phone: phone || null,
        source,
        stage,
        estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
        expected_close_date: expectedCloseDate || null,
      })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setName('')
    setCompanyName('')
    setEmail('')
    setPhone('')
    setSource('referral')
    setStage('new')
    setEstimatedValue('')
    setExpectedCloseDate('')
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
      <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">New Lead</h2>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-3">
          Lead added successfully!
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Contact name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Smith"
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Company name</label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Acme Ltd"
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Email address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="john@acme.co.uk"
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Phone number</label>
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="07700 900000"
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-dark mb-2">Source</label>
        <div className="flex gap-3 flex-wrap">
          {['referral', 'website', 'linkedin', 'cold_outreach', 'other'].map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                source === s
                  ? 'bg-brand-dark text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-dark mb-2">Stage</label>
        <div className="flex gap-3 flex-wrap">
          {['new', 'contacted', 'proposal_sent', 'negotiating'].map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                stage === s
                  ? 'bg-brand-dark text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Estimated value (£)</label>
        <input
          type="number"
          value={estimatedValue}
          onChange={(e) => setEstimatedValue(e.target.value)}
          placeholder="1200"
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Expected close date</label>
        <input
          type="date"
          value={expectedCloseDate}
          onChange={(e) => setExpectedCloseDate(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-brand-dark text-white font-semibold py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm"
      >
        {loading ? 'Adding lead...' : 'Add lead'}
      </button>
    </div>
  )
}
