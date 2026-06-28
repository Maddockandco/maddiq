import PageHeader from '@/components/layout/PageHeader'
import ClientList from '@/components/clients/ClientList'

export default function ClientsPage() {
  return (
    <div>
      <PageHeader
        title="Clients"
        description="Manage your client relationships"
        action={{ label: 'Add Client', href: '/clients/new' }}
      />
      <ClientList />
    </div>
  )
}
