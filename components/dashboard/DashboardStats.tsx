'use client'

export default function DashboardStats() {
  const stats = [
    { label: 'Total Clients', value: '0' },
    { label: 'Open Tasks', value: '0' },
    { label: 'Upcoming Deadlines', value: '0' },
    { label: 'Pipeline Leads', value: '0' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white rounded-2xl shadow-sm p-6">
          <p className="text-2xl font-bold text-brand-dark">{stat.value}</p>
          <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}
