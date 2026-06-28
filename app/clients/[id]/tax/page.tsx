import Link from 'next/link'
import ClientTaxEditForm from '@/components/clients/ClientTaxEditForm'

export default function ClientTaxPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/clients/${params.id}`} className="text-gray-400 hover:text-brand-dark transition text-sm">
          ← Back to client
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-brand-dark mb-8">Edit Tax Information</h1>
      <ClientTaxEditForm clientId={params.id} />
    </div>
  )
}
