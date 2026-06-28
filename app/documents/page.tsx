import PageHeader from '@/components/layout/PageHeader'
import DocumentList from '@/components/documents/DocumentList'

export default function DocumentsPage() {
  return (
    <div>
      <PageHeader
        title="Documents"
        description="All client documents in one place"
      />
      <DocumentList />
    </div>
  )
}
