import DashboardStats from '@/components/dashboard/DashboardStats'

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-dark">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back to Maddiq</p>
      </div>
      <DashboardStats />
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
        <h2 className="text-lg font-semibold text-brand-dark mb-2">Ready to get started?</h2>
        <p className="text-gray-500 text-sm mb-6">Add your first client to get started with Maddiq</p>
        <a href="/clients/new" className="inline-block bg-brand-dark text-white font-semibold px-6 py-2.5 rounded-lg text-sm">
          Add your first client
        </a>
      </div>
    </div>
  )
}
