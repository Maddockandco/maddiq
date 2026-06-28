import Link from 'next/link'
import ClientList from '@/components/clients/ClientList'

export default function ClientsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your client relationships</p>
        </div>
        <Link
          href="/clients/new"
          className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-opacity-90 transition"
        >
          + Add Client
        </Link>
      </div>
      <ClientList />
    </div>
  )
}
