import DocumentList from '@/components/documents/DocumentList'

export default function DocumentsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Documents</h1>
          <p className="text-sm text-gray-500 mt-1">All client documents in one place</p>
        </div>
      </div>
      <DocumentList />
    </div>
  )
}
