import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-brand-light">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <MobileHeader />
      <div className="flex-1 min-w-0 flex flex-col lg:ml-64">
        <main className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8 min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
