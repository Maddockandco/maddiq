import Link from 'next/link'
import ClientList from '@/components/clients/ClientList'

export default function ClientsPage() {
  return (
    <div>
      {/* Back button */}
      <div className="mb-4">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-brand-dark transition">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your client relationships</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-500">
            🔍 Search coming soon
          </div>
          <Link
            href="/clients/new"
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition flex items-center gap-2"
          >
            <span>+</span> Add Client
          </Link>
        </div>
      </div>
      <ClientList />
    </div>
  )
}
