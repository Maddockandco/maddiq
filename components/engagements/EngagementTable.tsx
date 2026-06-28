'use client'

export default function EngagementTable({ engagements, onEdit }: { engagements: any[]; onEdit: (e: any) => void }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
      <table className="w-full">
        <thead>
          <tr className="bg-brand-dark">
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Type</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Frequency</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Fee</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Start Date</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">End Date</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider"></th>
          </tr>
        </thead>
        <tbody>
          {engagements.map((eng, index) => (
            <tr key={eng.id} className={`border-b border-gray-100 hover:bg-amber-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
              <td className="px-6 py-4">
                <span className="text-sm font-medium text-brand-dark capitalize">{eng.type.replace(/_/g, ' ')}</span>
              </td>
              <td className="px-6 py-4">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                  eng.status === 'active' ? 'bg-green-100 text-green-700' :
                  eng.status === 'draft' ? 'bg-gray-100 text-gray-500' :
                  eng.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>{eng.status}</span>
              </td>
              <td className="px-6 py-4">
                <span className="text-sm text-gray-500 capitalize">{eng.frequency.replace(/_/g, ' ')}</span>
              </td>
              <td className="px-6 py-4">
                <span className="text-sm font-medium text-brand-dark">
                  {eng.fee_amount ? `£${Number(eng.fee_amount).toLocaleString()}` : '—'}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="text-sm text-gray-500">
                  {eng.start_date ? new Date(eng.start_date).toLocaleDateString('en-GB') : '—'}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="text-sm text-gray-500">
                  {eng.end_date ? new Date(eng.end_date).toLocaleDateString('en-GB') : '—'}
                </span>
              </td>
              <td className="px-6 py-4">
                <button onClick={() => onEdit(eng)} className="text-xs text-brand-gold hover:text-brand-dark transition font-medium">Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
