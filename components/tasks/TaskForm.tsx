'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TaskForm({ clientId }: { clientId?: string }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [selectedClientId, setSelectedClientId] = useState(clientId || '')
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchClients() {
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .order('name')
      if (data) setClients(data)
    }
    fetchClients()
  }, [])

  async function handleSubmit() {
    setLoading(true)
    setError('')
    setSuccess(false)

    if (!title) {
      setError('Task title is required')
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
      .select('firm_id, id')
      .eq('user_id', user.id)
      .single()

    if (!firmUser) {
      setError('Could not find your firm')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('tasks')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: selectedClientId || null,
        title,
        description: description || null,
        priority,
        due_date: dueDate || null,
        status: 'todo',
        type: 'internal',
        created_by: firmUser.id,
      })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTitle('')
    setDescription('')
    setPriority('medium')
    setDueDate('')
    setSelectedClientId(clientId || '')
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
      <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">New Task</h2>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-3">Task created successfully!</div>
      )}

      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Task title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Prepare VAT return"
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Any additional details..."
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
      </div>

      {!clientId && (
        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Client</label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          >
            <option value="">No client (internal task)</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Priority</label>
        <div className="flex gap-3">
          {['low', 'medium', 'high', 'urgent'].map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                priority === p
                  ? 'bg-brand-dark text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-dark mb-1">Due date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-brand-dark text-white font-semibold py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm"
      >
        {loading ? 'Creating task...' : 'Create task'}
      </button>
    </div>
  )
}
