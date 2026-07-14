'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/hooks/useRole'
import DatePicker from '@/components/ui/DatePicker'
import ConfirmModal from '@/components/ui/ConfirmModal'

const CATEGORY_LABELS: Record<string, string> = {
  main_pool: 'Main Pool (general plant & machinery)',
  special_rate_pool: 'Special Rate Pool (integral features, long-life assets)',
  car_zero_emission: 'Car — Zero Emission (0g/km CO₂)',
  car_main_rate: 'Car — Main Rate (≤50g/km CO₂)',
  car_special_rate: 'Car — Special Rate (>50g/km CO₂)',
  structures_buildings: 'Structures & Buildings',
}

const CAR_CATEGORIES = ['car_zero_emission', 'car_main_rate', 'car_special_rate']

export default function FixedAssetRegister({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const { can } = useRole()

  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'active' | 'disposed' | 'all'>('active')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('main_pool')
  const [dateAcquired, setDateAcquired] = useState(new Date().toISOString().split('T')[0])
  const [cost, setCost] = useState('')
  const [isNew, setIsNew] = useState(true)
  const [co2, setCo2] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [notes, setNotes] = useState('')

  const [disposingAsset, setDisposingAsset] = useState<any>(null)
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().split('T')[0])
  const [disposalProceeds, setDisposalProceeds] = useState('')
  const [disposalReason, setDisposalReason] = useState('')
  const [disposalError, setDisposalError] = useState('')
  const [disposing, setDisposing] = useState(false)

  useEffect(() => { fetchAssets() }, [clientId, statusFilter])

  async function fetchAssets() {
    setLoading(true)
    let query = supabase.from('fixed_assets').select('*').eq('client_id', clientId).order('date_acquired', { ascending: false })
    if (statusFilter === 'active') query = query.is('date_disposed', null)
    if (statusFilter === 'disposed') query = query.not('date_disposed', 'is', null)
    const { data } = await query
    if (data) setAssets(data)
    setLoading(false)
  }

  function openNewForm() {
    setDescription('')
    setCategory('main_pool')
    setDateAcquired(new Date().toISOString().split('T')[0])
    setCost('')
    setIsNew(true)
    setCo2('')
    setSupplierName('')
    setNotes('')
    setEditingId(null)
    setError('')
    setFormOpen(true)
  }

  function openEditForm(asset: any) {
    setDescription(asset.description)
    setCategory(asset.category)
    setDateAcquired(asset.date_acquired)
    setCost(String(asset.cost))
    setIsNew(asset.is_new)
    setCo2(asset.co2_emissions != null ? String(asset.co2_emissions) : '')
    setSupplierName(asset.supplier_name || '')
    setNotes(asset.notes || '')
    setEditingId(asset.id)
    setError('')
    setFormOpen(true)
  }

  function handleSaveClick() {
    if (!description.trim() || !cost || parseFloat(cost) <= 0) {
      setError('A description and a cost greater than zero are required')
      return
    }
    if (CAR_CATEGORIES.includes(category) && category !== 'car_zero_emission' && !co2) {
      setError('CO₂ emissions (g/km) are required for cars, since this determines the correct pool')
      return
    }
    setShowConfirm(true)
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user!.id).single()
    if (!firmUser) { setError('Could not find your firm'); setSaving(false); setShowConfirm(false); return }

    const payload = {
      firm_id: firmUser.firm_id,
      client_id: clientId,
      description: description.trim(),
      category,
      date_acquired: dateAcquired,
      cost: parseFloat(cost),
      is_new: isNew,
      co2_emissions: CAR_CATEGORIES.includes(category) ? (co2 ? parseInt(co2) : (category === 'car_zero_emission' ? 0 : null)) : null,
      supplier_name: supplierName || null,
      notes: notes || null,
    }

    if (editingId) {
      const { error: updateError } = await supabase.from('fixed_assets').update(payload).eq('id', editingId)
      if (updateError) { setError(updateError.message); setSaving(false); setShowConfirm(false); return }
    } else {
      const { error: insertError } = await supabase.from('fixed_assets').insert({ ...payload, created_by: user!.id })
      if (insertError) { setError(insertError.message); setSaving(false); setShowConfirm(false); return }
    }

    setShowConfirm(false)
    setFormOpen(false)
    setSaving(false)
    fetchAssets()
  }

  function openDisposeForm(asset: any) {
    setDisposingAsset(asset)
    setDisposalDate(new Date().toISOString().split('T')[0])
    setDisposalProceeds('')
    setDisposalReason('')
    setDisposalError('')
  }

  async function handleDispose() {
    if (!disposalProceeds) {
      setDisposalError('Disposal proceeds are required — enter 0 if the asset was scrapped with no value')
      return
    }
    setDisposing(true)
    setDisposalError('')

    const { error: disposeError } = await supabase
      .from('fixed_assets')
      .update({
        date_disposed: disposalDate,
        disposal_proceeds: parseFloat(disposalProceeds),
        disposal_reason: disposalReason || null,
      })
      .eq('id', disposingAsset.id)

    if (disposeError) { setDisposalError(disposeError.message); setDisposing(false); return }

    setDisposingAsset(null)
    setDisposing(false)
    fetchAssets()
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
  const totalCost = assets.reduce((sum, a) => sum + parseFloat(a.cost), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['active', 'disposed', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition capitalize ${statusFilter === s ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}
            >
              {s}
            </button>
          ))}
        </div>
        {can.manageEngagements && (
          <button onClick={openNewForm} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
            + Add Asset
          </button>
        )}
      </div>

      {!loading && assets.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Total cost ({statusFilter})</p>
          <p className="text-xl font-semibold text-brand-dark">£{totalCost.toFixed(2)}</p>
        </div>
      )}

      {formOpen && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">{editingId ? 'Edit Asset' : 'New Asset'}</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="e.g. Toyota Corolla, Dell laptop x3, warehouse racking" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date Acquired</label>
              <DatePicker value={dateAcquired} onChange={setDateAcquired} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cost (£)</label>
              <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Supplier (optional)</label>
              <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={inputClass} />
            </div>
          </div>

          {CAR_CATEGORIES.includes(category) && category !== 'car_zero_emission' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">CO₂ Emissions (g/km)</label>
              <input type="number" value={co2} onChange={(e) => setCo2(e.target.value)} className={inputClass} placeholder="e.g. 120" />
              <p className="text-xs text-gray-400 mt-1">≤50g/km → Main Rate pool, &gt;50g/km → Special Rate pool. Make sure this matches the category selected above.</p>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} className="w-4 h-4 accent-brand-dark" />
            <span className="text-sm text-brand-dark">Brand new (not second-hand) — affects Full Expensing eligibility</span>
          </label>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
          </div>

          <div className="flex gap-3">
            <button onClick={handleSaveClick} className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition">
              {editingId ? 'Save Changes' : 'Add Asset'}
            </button>
            <button onClick={() => setFormOpen(false)} className="bg-gray-100 text-gray-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title={editingId ? 'Save changes to this asset?' : 'Add this asset to the register?'}
        message={`${description} — £${parseFloat(cost || '0').toFixed(2)}, ${CATEGORY_LABELS[category]}`}
        confirmLabel={editingId ? 'Save Changes' : 'Add Asset'}
        confirming={saving}
        onConfirm={handleSave}
        onCancel={() => setShowConfirm(false)}
      />

      {disposingAsset && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-brand-dark">Dispose of "{disposingAsset.description}"?</h3>
              <p className="text-sm text-gray-500 mt-1">
                This will be needed later to calculate any balancing charge or allowance.
              </p>
            </div>
            {disposalError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{disposalError}</div>}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Disposal Date</label>
              <DatePicker value={disposalDate} onChange={setDisposalDate} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Disposal Proceeds (£)</label>
              <input
                type="number"
                value={disposalProceeds}
                onChange={(e) => setDisposalProceeds(e.target.value)}
                className={inputClass}
                placeholder="Enter 0 if scrapped with no value"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reason (optional)</label>
              <textarea
                value={disposalReason}
                onChange={(e) => setDisposalReason(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="e.g. sold, scrapped, traded in"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDispose}
                disabled={disposing}
                className="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-red-700 transition disabled:opacity-50"
              >
                {disposing ? 'Recording...' : 'Record Disposal'}
              </button>
              <button
                onClick={() => setDisposingAsset(null)}
                className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : assets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No {statusFilter !== 'all' ? statusFilter : ''} assets on the register yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-brand-dark">
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Description</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Category</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Acquired</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Cost</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a, i) => (
                <tr key={a.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-6 py-3 text-sm font-medium text-brand-dark">
                    {a.description}
                    {a.notes && <p className="text-xs text-gray-400">{a.notes}</p>}
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-500">
                    {CATEGORY_LABELS[a.category]}
                    {a.co2_emissions != null && ` (${a.co2_emissions}g/km)`}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{new Date(a.date_acquired).toLocaleDateString('en-GB')}</td>
                  <td className="px-6 py-3 text-sm font-semibold text-brand-dark">£{parseFloat(a.cost).toFixed(2)}</td>
                  <td className="px-6 py-3">
                    {a.date_disposed ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                        Disposed {new Date(a.date_disposed).toLocaleDateString('en-GB')}
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Active</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {can.manageEngagements && !a.date_disposed && (
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => openEditForm(a)} className="text-xs text-brand-dark font-medium hover:underline">Edit</button>
                        <button onClick={() => openDisposeForm(a)} className="text-xs text-red-500 font-medium hover:underline">Dispose</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
