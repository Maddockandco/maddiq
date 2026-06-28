import Link from 'next/link'
import ClientTabs from '@/components/clients/ClientTabs'

export default function ClientPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/clients" className="text-gray-400 hover:text-brand-dark transition text-sm">
          ← Back to clients
        </Link>
      </div>
      <ClientTabs clientId={params.id} />
    </div>
  )
}
