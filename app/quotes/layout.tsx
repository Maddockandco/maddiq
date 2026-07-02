import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'

export default function QuotesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-brand-light">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <MobileHeader />
      <div className="lg:ml-64">
        <main className="p-4 lg:p-8 pt-20 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  )
}
