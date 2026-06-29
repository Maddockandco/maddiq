import DashboardStats from '@/components/dashboard/DashboardStats'
import RecentActivity from '@/components/dashboard/RecentActivity'

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-dark">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back to Maddiq</p>
      </div>
      <DashboardStats />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-6">
            Upcoming Deadlines
          </h3>
          <p className="text-gray-500 text-sm text-center py-6">
            No upcoming deadlines — add clients to generate deadlines
          </p>
        </div>
      </div>
    </div>
  )
}
