export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-brand-light p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-brand-dark">Dashboard</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <h2 className="text-xl font-semibold text-brand-dark mb-2">
            Welcome to Maddiq 👋
          </h2>
          <p className="text-gray-500 text-sm">
            Your AI-native accounting platform is being built. Check back soon!
          </p>
        </div>
      </div>
    </main>
  )
}
