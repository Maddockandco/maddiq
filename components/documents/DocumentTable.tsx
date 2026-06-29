'use client'

export default function DocumentTable({ documents }: { documents: any[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-brand-dark">
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Name</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Client</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Category</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Shared</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc, index) => (
              <tr key={doc.id} className={`border-b border-gray-100 hover:bg-amber-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="px-6 py-4"><span className="font-medium text-brand-dark text-sm">{doc.name}</span></td>
                <td className="px-6 py-4"><span className="text-sm text-gray-500">{doc.clients?.name || '—'}</span></td>
                <td className="px-6 py-4">
                  <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                    {doc.category.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${doc.shared_with_client ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {doc.shared_with_client ? 'Shared' : 'Internal'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString('en-GB')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
