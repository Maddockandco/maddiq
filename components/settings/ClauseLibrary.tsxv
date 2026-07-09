'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const GOVERNING_BODIES = [
  { value: 'icaew', label: 'ICAEW' },
  { value: 'acca', label: 'ACCA' },
  { value: 'aat', label: 'AAT' },
  { value: 'cima', label: 'CIMA' },
  { value: 'iab', label: 'IAB' },
]

const DEFAULT_CHECKLIST_ITEMS = [
  { category_key: 'engagement_scope', label: 'Engagement Letter — Scope & Parties', is_required: true, sort_order: 0 },
  { category_key: 'service_schedule', label: 'Service Schedule (per engaged service)', is_required: true, sort_order: 1 },
  { category_key: 'terms_of_business', label: 'Terms of Business (fees, payment, termination)', is_required: true, sort_order: 2 },
  { category_key: 'liability', label: 'Limitation of Liability', is_required: false, sort_order: 3 },
  { category_key: 'money_laundering', label: 'Money Laundering / AML Obligations', is_required: true, sort_order: 4 },
  { category_key: 'gdpr', label: 'Privacy Notice / GDPR Data Processing', is_required: true, sort_order: 5 },
  { category_key: 'id_verification', label: 'ID Verification / ACSP Schedule (if filing with Companies House)', is_required: true, sort_order: 6 },
  { category_key: 'ai_disclosure', label: 'Use of AI / Software Tools Disclosure', is_required: true, sort_order: 7 },
  { category_key: 'complaints', label: 'Complaints Procedure', is_required: true, sort_order: 8 },
  { category_key: 'termination', label: 'Disengagement / Termination Terms', is_required: true, sort_order: 9 },
]

// Original, generic starting drafts — NOT sourced from or verified against any professional
// body's actual published wording. These exist purely as a scaffold so you're not starting
// from a blank page. Every clause must be reviewed against your governing body's current
// official guidance (or by a solicitor) before it's relied on with a real client.
const DEFAULT_CLAUSES = [
  { category_key: 'engagement_scope', title: 'Scope of Engagement', body: 'This letter confirms the scope of services [Firm Name] will provide to [Client Name], the basis on which we will work together, and the responsibilities of both parties. It applies from [start date] and remains in effect until varied or terminated in writing. Please read this letter alongside the attached service schedule(s) and terms of business, which form part of this agreement.' },
  { category_key: 'service_schedule', title: 'Service Schedule Introduction', body: 'The attached schedule(s) set out the specific services we have agreed to provide, including the tasks covered, information we will need from you, deadlines, and any exclusions. A separate schedule applies to each distinct service (for example, annual accounts, tax returns, VAT, payroll, or bookkeeping) and should be reviewed whenever the services you receive from us change.' },
  { category_key: 'terms_of_business', title: 'Terms of Business', body: "Our fees are based on [basis — e.g. fixed fee / hourly rate / value] and are payable [payment terms]. Either party may end this engagement by giving [notice period] written notice. On termination, fees for work completed to that date remain payable. These terms, together with the engagement letter and service schedules, form the entire agreement between us." },
  { category_key: 'liability', title: 'Limitation of Liability', body: "To the extent permitted by law and by our professional body's guidance, our liability to you for losses arising from our services is limited to [amount/formula]. This limitation does not apply to liability that cannot be excluded by law, including liability for fraud or for death or personal injury caused by our negligence." },
  { category_key: 'money_laundering', title: 'Money Laundering Obligations', body: 'As a firm supervised for anti-money laundering purposes, we are required by law to verify your identity and, where applicable, the identity of your beneficial owners, before we can act for you. We are also required to report certain types of knowledge or suspicion of money laundering to the National Crime Agency, and the law prohibits us from informing you if we have made such a report.' },
  { category_key: 'gdpr', title: 'Data Protection / Privacy Notice', body: 'We collect and process personal data about you in order to provide our services, comply with our legal and regulatory obligations, and communicate with you. We will hold this data securely and will not share it with third parties except where required by law, necessary to deliver our services, or with your consent. You have rights under UK GDPR to access, correct, or request deletion of your personal data.' },
  { category_key: 'id_verification', title: 'Identity Verification (ACSP) Schedule', body: 'Where we act as your Companies House Authorised Corporate Service Provider (ACSP), we are required to verify the identity of the individuals filing on your behalf before certain filings can be accepted. This may involve you or your officers providing identification documents and completing an identity verification process, which we will guide you through as required.' },
  { category_key: 'ai_disclosure', title: 'Use of AI and Software Tools', body: 'We may use artificial intelligence tools and other software as part of delivering our services, for example to assist with drafting, data analysis, or administrative tasks. Any such tools are used under our supervision, with professional judgement applied to their output before it is relied upon. We take reasonable steps to ensure any third-party technology providers we use maintain appropriate standards of data protection and confidentiality.' },
  { category_key: 'complaints', title: 'Complaints Procedure', body: 'If you are ever unhappy with our service, please raise this with [named contact] in the first instance. We will acknowledge your complaint within [X] working days and aim to resolve it within [X] days. If you remain unsatisfied, you may refer the matter to [governing body]\'s complaints scheme.' },
  { category_key: 'termination', title: 'Disengagement', body: 'Either party may terminate this engagement at any time by giving written notice. On termination, we will take reasonable steps to hand over your affairs in an orderly manner, subject to payment of any outstanding fees. We may also need to notify relevant authorities (such as HMRC) that we no longer act for you.' },
]

export default function ClauseLibrary() {
  const [selectedBody, setSelectedBody] = useState('icaew')
  const [checklistItems, setChecklistItems] = useState<any[]>([])
  const [clauses, setClauses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [editingClauseId, setEditingClauseId] = useState<string | null>(null)
  const [clauseTitle, setClauseTitle] = useState('')
  const [clauseCategory, setClauseCategory] = useState('')
  const [clauseBody, setClauseBody] = useState('')
  const [addingClause, setAddingClause] = useState(false)
  const [saving, setSaving] = useState(false)
  const [firmId, setFirmId] = useState('')
  const supabase = createClient()

  useEffect(() => { fetchData() }, [selectedBody])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: firmUser } = await supabase
      .from('firm_users')
      .select('firm_id')
      .eq('user_id', user.id)
      .single()
    if (!firmUser) return
    setFirmId(firmUser.firm_id)

    const [checklistRes, clausesRes] = await Promise.all([
      supabase.from('compliance_checklist_items').select('*').eq('firm_id', firmUser.firm_id).eq('governing_body', selectedBody).order('sort_order'),
      supabase.from('clause_library').select('*').eq('firm_id', firmUser.firm_id).eq('governing_body', selectedBody).order('sort_order'),
    ])

    setChecklistItems(checklistRes.data || [])
    setClauses(clausesRes.data || [])
    setLoading(false)
  }

  async function handleSeedDefaults() {
    setSeeding(true)

    await supabase.from('compliance_checklist_items').insert(
      DEFAULT_CHECKLIST_ITEMS.map((item) => ({ ...item, firm_id: firmId, governing_body: selectedBody }))
    )

    await supabase.from('clause_library').insert(
      DEFAULT_CLAUSES.map((c, i) => ({
        ...c,
        firm_id: firmId,
        governing_body: selectedBody,
        review_status: 'draft_needs_review',
        sort_order: i,
      }))
    )

    fetchData()
    setSeeding(false)
  }

  async function handleToggleRequired(itemId: string, isRequired: boolean) {
    await supabase.from('compliance_checklist_items').update({ is_required: !isRequired }).eq('id', itemId)
    setChecklistItems(checklistItems.map((i) => i.id === itemId ? { ...i, is_required: !isRequired } : i))
  }

  async function handleDeleteChecklistItem(itemId: string) {
    await supabase.from('compliance_checklist_items').delete().eq('id', itemId)
    fetchData()
  }

  function openAddClause() {
    setEditingClauseId(null)
    setClauseTitle('')
    setClauseCategory(checklistItems[0]?.category_key || '')
    setClauseBody('')
    setAddingClause(true)
  }

  function openEditClause(clause: any) {
    setEditingClauseId(clause.id)
    setClauseTitle(clause.title)
    setClauseCategory(clause.category_key)
    setClauseBody(clause.body)
    setAddingClause(true)
  }

  async function handleSaveClause() {
    setSaving(true)
    if (editingClauseId) {
      await supabase.from('clause_library').update({
        title: clauseTitle,
        category_key: clauseCategory,
        body: clauseBody,
        updated_at: new Date().toISOString(),
      }).eq('id', editingClauseId)
    } else {
      await supabase.from('clause_library').insert({
        firm_id: firmId,
        governing_body: selectedBody,
        title: clauseTitle,
        category_key: clauseCategory,
        body: clauseBody,
        review_status: 'draft_needs_review',
        sort_order: clauses.length,
      })
    }
    setAddingClause(false)
    setSaving(false)
    fetchData()
  }

  async function handleMarkReviewed(clauseId: string, currentStatus: string) {
    const newStatus = currentStatus === 'reviewed' ? 'draft_needs_review' : 'reviewed'
    await supabase.from('clause_library').update({ review_status: newStatus }).eq('id', clauseId)
    setClauses(clauses.map((c) => c.id === clauseId ? { ...c, review_status: newStatus } : c))
  }

  async function handleDeleteClause(clauseId: string) {
    await supabase.from('clause_library').delete().eq('id', clauseId)
    fetchData()
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-700 mb-1">⚠️ Not legal advice — review before use</p>
        <p className="text-xs text-amber-600">
          Any clause text here — including anything seeded automatically — is a generic starting draft, not verified against your governing body's actual current published requirements.
          Review each clause against your own membership resources (or a solicitor) and mark it "Reviewed" before relying on it with a real client engagement letter.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {GOVERNING_BODIES.map((b) => (
          <button
            key={b.value}
            onClick={() => setSelectedBody(b.value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              selectedBody === b.value ? 'bg-brand-dark text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <>
          {checklistItems.length === 0 && clauses.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-500 mb-4">No checklist or clauses set up yet for {GOVERNING_BODIES.find(b => b.value === selectedBody)?.label}.</p>
              <button
                onClick={handleSeedDefaults}
                disabled={seeding}
                className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition disabled:opacity-50"
              >
                {seeding ? 'Setting up...' : 'Seed starting checklist & draft clauses'}
              </button>
            </div>
          )}

          {checklistItems.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">Compliance Checklist</h3>
              <div className="space-y-2">
                {checklistItems.map((item) => {
                  const hasClause = clauses.some((c) => c.category_key === item.category_key)
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${hasClause ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {hasClause ? '✓' : '✗'}
                        </span>
                        <span className="text-sm text-brand-dark">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleRequired(item.id, item.is_required)}
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition ${item.is_required ? 'bg-brand-gold/20 text-brand-dark' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {item.is_required ? 'Required' : 'Optional'}
                        </button>
                        <button onClick={() => handleDeleteChecklistItem(item.id)} className="text-xs text-red-500 hover:underline">
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Clause Library</h3>
              <button onClick={openAddClause} className="text-xs bg-brand-dark text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition">
                + Add Clause
              </button>
            </div>

            {addingClause && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                  <input type="text" value={clauseTitle} onChange={(e) => setClauseTitle(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <select value={clauseCategory} onChange={(e) => setClauseCategory(e.target.value)} className={inputClass}>
                    {DEFAULT_CHECKLIST_ITEMS.map((c) => <option key={c.category_key} value={c.category_key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Clause text</label>
                  <textarea value={clauseBody} onChange={(e) => setClauseBody(e.target.value)} rows={5} className={inputClass} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveClause} disabled={saving} className="bg-brand-dark text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save clause'}
                  </button>
                  <button onClick={() => setAddingClause(false)} className="text-sm text-gray-500 hover:underline px-2">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {clauses.length === 0 ? (
              <p className="text-sm text-gray-400">No clauses yet.</p>
            ) : (
              <div className="space-y-3">
                {clauses.map((clause) => (
                  <div key={clause.id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-brand-dark">{clause.title}</p>
                        <p className="text-xs text-gray-400">{DEFAULT_CHECKLIST_ITEMS.find(c => c.category_key === clause.category_key)?.label || clause.category_key}</p>
                      </div>
                      <button
                        onClick={() => handleMarkReviewed(clause.id, clause.review_status)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full transition ${
                          clause.review_status === 'reviewed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {clause.review_status === 'reviewed' ? '✓ Reviewed' : 'Draft — needs review'}
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{clause.body}</p>
                    <div className="flex gap-3">
                      <button onClick={() => openEditClause(clause)} className="text-xs text-brand-dark font-medium hover:underline">Edit</button>
                      <button onClick={() => handleDeleteClause(clause.id)} className="text-xs text-red-500 font-medium hover:underline">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
