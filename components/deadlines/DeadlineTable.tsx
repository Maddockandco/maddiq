'use client'

export default function DeadlineTable({ deadlines }: { deadlines: any[] }) {
  // Group deadlines by client
  const grouped = deadlines.reduce((acc: any, deadline: any) => {
    const clientName = deadline.clients?.name || 'Unknown'
    if (!acc[clientName]) acc[clientName] = []
    acc[clientName].push(deadline)
    return acc
  }, {})

  const statusColour = (status: string) => {
    if (status === 'filed') return 'bg-green-100 text-green-700'
    if (status === 'overdue') return 'bg-red-100 text-red-700'
    if (status === 'upcoming') return 'bg-blue-100 text-blue-700'
    return 'bg-gray-100 text-gray-500'
  }

  const dueDateColour = (daysUntilDue: number, isOverdue: boolean) => {
    if (isOverdue) return 'text-red-600'
    if (daysUntilDue <= 30) return 'text-amber-600'
    return 'text-brand-dark'
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([clientName, clientDeadlines]: [string, any]) => (
        <div key={clientName} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          {/* Client header */}
          <div className="bg-brand-dark px-6 py-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{clientName}</h3>
            <span className="text-xs text-white/50">{clientDeadlines.length} deadline{clientDeadlines.length > 1 ? 's' : ''}</span>
          </div>

          {/* Deadlines for this client */}
          <div className="divide-y divide-gray-50">
            {clientDeadlines
              .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
              .map((deadline: any) => {
                const dueDate = new Date(deadline.due_date)
                const today = new Date()
                const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                const isOverdue = daysUntilDue < 0
                const isDueSoon = daysUntilDue <= 30 && daysUntilDue >= 0

                return (
                  <div key={deadline.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-brand-dark">
                        {deadline.notes || deadline.type.replace(/_/g, ' ')}
                      </p>
                      {deadline.period_end && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Period ending {new Date(deadline.period_end).toLocaleDateString('en-GB')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${dueDateColour(daysUntilDue, isOverdue)}`}>
                          {dueDate.toLocaleDateString('en-GB')}
                        </p>
                        {isOverdue && (
                          <p className="text-xs text-red-500 mt-0.5">🚨 {Math.abs(daysUntilDue)} days overdue</p>
                        )}
                        {isDueSoon && (
                          <p className="text-xs text-amber-500 mt-0.5">⚠️ Due in {daysUntilDue} days</p>
                        )}
                      </div>
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap ${statusColour(deadline.status)}`}>
                        {deadline.status}
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
