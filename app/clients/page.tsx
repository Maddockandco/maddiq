'use client'

import ClientList from '@/components/clients/ClientList'
import { useRole } from '@/hooks/useRole'
import Link from 'next/link'

export default function ClientsPage() {
  const { can } = useRole()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your client relationships</p>
        </div>
        {can.addClient && (
          <Link
            href="/clients/new"
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            + Add Client
          </Link>
        )}
      </div>
      <ClientList />
    </div>
  )
}
