'use client'

import Link from 'next/link'
import { Building2, User, Users } from 'lucide-react'

const TYPE_ICONS: Record<string, any> = {
  company: Building2,
  individual: User,
  partnership: Users,
}

const TYPE_STYLES: Record<string, string> = {
  company: 'bg-blue-100 text-blue-700',
  individual: 'bg-purple-100 text-purple-700',
  partnership: 'bg-amber-100 text-amber-700',
}

export default function ClientTable({ clients }: { clients: any[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-brand-dark">
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Name</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Type</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Industry</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Assigned To</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Email</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client, index) => {
              const TypeIcon = TYPE_ICONS[client.type] || Building2
              return (
                <tr key={client.id} className={`border-b border-gray-100 hover:bg-amber-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-6 py-4">
                    <Link href={`/clients/${client.id}`} className="font-semibold text-brand-dark hover:text-brand-gold transition-colors">
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium capitalize px-2.5 py-1 rounded-full ${TYPE_STYLES[client.type] || 'bg-gray-100 text-gray-600'}`}>
                      <TypeIcon size={12} />
                      {client.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                      client.status === 'active' ? 'bg-green-100 text-green-700' :
                      client.status === 'prospect' ? 'bg-blue-100 text-blue-700' :
                      client.status === 'onboarding' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>{client.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{client.industry || '—'}</span>
                  </td>
                  <td className="px-6 py-4">
                    {client.firm_users ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-brand-dark flex items-center justify-center">
                          <span className="text-white text-xs font-semibold">
                            {client.firm_users.full_name?.[0] || '?'}
                          </span>
                        </div>
                        <span className="text-sm text-gray-600">{client.firm_users.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{client.email || '—'}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
