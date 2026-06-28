'use client'

import Link from 'next/link'

export default function ClientTable({ clients }: { clients: any[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200">
      <table className="w-full">
        <thead>
          <tr className="bg-brand-dark">
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Name</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Type</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Industry</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Email</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client, index) => (
            <tr
              key={client.id}
              className={`border-b border-gray-100 hover:bg-amber-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
            >
              <td className="px-6 py-4">
                <Link href={`/clients/${client.id}`} className="font-semibold text-brand-dark hover:text-brand-gold transition-colors">
                  {client.name}
                </Link>
              </td>
              <td className="px-6 py-4"><span className="text-sm text-gray-500 capitalize">{client.type}</span></td>
              <td className="px-6 py-4">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                  client.status === 'active' ? 'bg-green-100 text-green-700' :
                  client.status === 'prospect' ? 'bg-blue-100 text-blue-700' :
                  client.status === 'onboarding' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-500'
                }`}>{client.status}</span>
              </td>
              <td className="px-6 py-4"><span className="text-sm text-gray-600">{client.industry || '—'}</span></td>
              <td className="px-6 py-4"><span className="text-sm text-gray-600">{client.email || '—'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
