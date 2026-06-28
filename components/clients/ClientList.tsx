'use client'

import Link from 'next/link'

type Client = {
  id: string
  name: string
  type: string
  status: string
  industry: string | null
  email: string | null
}

export default function ClientTable({ clients }: { clients: Client[] }) {
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
              className={`border-b border-gray-50 hover:bg-brand-light transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
            >
              <td className="px-6 py-4">
                <Link href={`/clients/${client.id}`} className="font-medium text-brand-dark hover:text-brand-gold transition-colors">
                  {client.name}
                </Link>
              </td>
              <td className="px-6 py-4"><span className="text-sm text-gray-500 capitalize">{client.type}</span></td>
              <td className="px-6 py-4">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                  client.status === 'active' ? 'bg-green-50 text-green-600' :
                  client.status === 'prospect' ? 'bg-blue-50 text-blue-600' :
                  client.status === 'onboarding' ? 'bg-amber-50 text-amber-600' :
                  'bg-gray-50 text-gray-500'
                }`}>{client.status}</span>
              </td>
              <td className="px-6 py-4"><span className="text-sm text-gray-500">{client.industry || '—'}</span></td>
              <td className="px-6 py-4"><span className="text-sm text-gray-500">{client.email || '—'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
