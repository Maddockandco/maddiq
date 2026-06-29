'use client'

import Link from 'next/link'
import ClientEditForm from '@/components/clients/ClientEditForm'
import { useRole } from '@/hooks/useRole'

export default function ClientEditPage({ params }: { params: { id: string } }) {
  const { can } = useRole()

  if (!can.editClientDetails) {
    return (
      <div>
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/clients/${params.id}`} className="text-gray-400 hover:text-brand-dark transition text-sm">
            ← Back to client
          </Link>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">You don't have permission to edit client details.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/clients/${params.id}`} className="text-gray-400 hover:text-brand-dark transition text-sm">
          ← Back to client
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-brand-dark mb-8">Edit Client</h1>
      <ClientEditForm clientId={params.id} />
    </div>
  )
}
