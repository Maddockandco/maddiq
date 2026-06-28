'use client'

export default function PipelineTable({ leads }: { leads: any[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
      <table className="w-full">
        <thead>
          <tr className="bg-brand-dark">
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Name</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Company</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Stage</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Source</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Value</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, index) => (
            <tr key={lead.id} className={`border-b border-gray-100 hover:bg-amber-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
              <td className="px-6 py-4"><span className="font-medium text-brand-dark text-sm">{lead.name}</span></td>
              <td className="px-6 py-4"><span className="text-sm text-gray-500">{lead.company_name || '—'}</span></td>
              <td className="px-6 py-4">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                  lead.stage === 'won' ? 'bg-green-100 text-green-700' :
                  lead.stage === 'lost' ? 'bg-red-100 text-red-700' :
                  lead.stage === 'proposal_sent' ? 'bg-blue-100 text-blue-700' :
                  lead.stage === 'negotiating' ? 'bg-purple-100 text-purple-700' :
                  lead.stage === 'contacted' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-500'
                }`}>{lead.stage.replace(/_/g, ' ')}</span>
              </td>
              <td className="px-6 py-4"><span className="text-sm text-gray-500 capitalize">{lead.source.replace(/_/g, ' ')}</span></td>
              <td className="px-6 py-4">
                <span className="text-sm font-medium text-brand-dark">
                  {lead.estimated_value ? `£${Number(lead.estimated_value).toLocaleString()}` : '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
