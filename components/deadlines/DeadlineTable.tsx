'use client'

export default function DeadlineTable({ deadlines }: { deadlines: any[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-brand-dark">
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Client</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Type</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Period</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Due Date</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {deadlines.map((deadline, index) => {
              const dueDate = new Date(deadline.due_date)
              const today = new Date()
              const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
              const isOverdue = daysUntilDue < 0
              const isDueSoon = daysUntilDue <= 7 && daysUntilDue >= 0
              return (
                <tr key={deadline.id} className={`border-b border-gray-100 hover:bg-amber-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-6 py-4"><span className="font-medium text-brand-dark text-sm">{deadline.clients?.name || '—'}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600 capitalize">{deadline.type.replace(/_/g, ' ')}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-500">{deadline.period_end ? new Date(deadline.period_end).toLocaleDateString('en-GB') : '—'}</span></td>
                  <td className="px-6 py-4">
                    <div>
                      <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-brand-dark'}`}>{dueDate.toLocaleDateString('en-GB')}</span>
                      {isOverdue && <p className="text-xs text-red-500 mt-0.5">{Math.abs(daysUntilDue)} days overdue</p>}
                      {isDueSoon && <p className="text-xs text-amber-500 mt-0.5">Due in {daysUntilDue} days</p>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                      deadline.status === 'filed' ? 'bg-green-100 text-green-700' :
                      deadline.status === 'overdue' ? 'bg-red-100 text-red-700' :
                      deadline.status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>{deadline.status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
