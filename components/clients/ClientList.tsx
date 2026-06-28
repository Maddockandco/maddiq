'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Client = {
  id: string
  name: string
  type: string
  status: string
  industry: string | null
  email: string | null
  phone: string | null
}

export default function ClientList() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchClients() {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, type, status, industry, email, phone')
        .order('name')

      if (!error && data) setClients(data)
      setLoading(false)
    }
    fetchClients()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-100">
        <p className="text-gray-500 text-sm">Loading clients...</p>
      </div>
    )
  }

  if (clients.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-100">
        <h2 className="text-lg font-semibold text-brand-dark mb-2">
          No clients yet
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Add your first client to get started
        </p>
        <Link
          href="/clients/new"
          className="inline-block bg-brand-dark text-white font-semibold px-6 py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition"
        >
          Add your first client
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Industry</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client, index) => (
            <tr
              key={client.id}
              className={`border-b border-gray-50 hover:bg-brand-light transition-colors ${
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
              }`}
            >
              <td
