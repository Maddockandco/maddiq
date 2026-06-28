'use client'

export default function DashboardPage() {
  const stats = [
    { label: 'Total Clients', value: '0', color: 'bg-blue-50 text-blue-600' },
    { label: 'Open Tasks', value: '0', color: 'bg-amber-50 text-amber-600' },
    { label: 'Upcoming Deadlines', value: '0', color: 'bg-red-50 text-red-600' },
    { label: 'Pipeline Leads', value: '0', color: 'bg-green-50 text-green-600' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-dark">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back to Maddiq</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl shadow-sm p-6"
          >
            <p className="text-2xl font-bold text-brand-dark">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Empty state */}
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
        <h2 className="text-lg font-semibold text-brand-dark mb-2">
          Ready to get started? 🚀
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Add your first client to get started with Maddiq
        </p>
        
          href="/clients/new"
          className="inline-block bg-brand-dark text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-opacity-90 transition text-sm"
        >
          Add your first client
        </a>
      </div>
    </div>
  )
}
