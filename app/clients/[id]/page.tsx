import Link from 'next/link'
import ClientDetail from '@/components/clients/ClientDetail'

export default function ClientPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/clients" className="text-gray-400 hover:text-brand-dark transition text-sm">
          ← Back to clients
        </Link>
      </div>
      <ClientDetail clientId={params.id} />
    </div>
  )
}
