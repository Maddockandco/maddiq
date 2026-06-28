'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TaskEditForm({ taskId }: { taskId: string }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [status, setStatus] = useState('todo')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchTask() {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()
      if (data) {
        setTitle(data.title || '')
        setDescription(data.description || '')
        setPriority(data.priority || 'medium')
        setStatus(data.status || 'todo')
        setDueDate(data.due_date || '')
      }
      setLoading(false)
    }
    fetchTask()
  }, [taskId])

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess(false)

    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        title,
        description: description || null,
        priority,
        status,
        due_date: dueDate || null,
      })
      .eq('id', taskId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this task?')) return

    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      window.location.href = '/tasks'
    }
  }

  async function handleMarkComplete() {
    setSaving(true)
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', taskId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setStatus('done')
      setSuccess(true)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
        <p className="text-gray-500 text-sm">Loading task...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 text-sm rounded-lg px-4 py-3">Task updated successfully!</div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
        <h2 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">Edit Task</h2>

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Task title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-dark mb-2">Priority</label>
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
          <label className="block text-sm font-medium text-brand-dark mb-2">Status</label>
          <div className="flex gap-3 flex-wrap">
            {['todo', 'in_progress', 'blocked', 'done'].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                  status === s
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
          <label className="block text-sm font-medium text-brand-dark mb-1">Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-brand-dark text-white font-semibold py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {status !== 'done' && (
            <button
              onClick={handleMarkComplete}
              disabled={saving}
              className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm"
            >
              ✅ Mark complete
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6">
        <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-4">Danger Zone</h3>
        <button
          onClick={handleDelete}
          className="w-full bg-red-50 text-red-600 font-semibold py-3 rounded-lg hover:bg-red-100 transition text-sm"
        >
          Delete task
        </button>
      </div>
    </div>
  )
}
