import Sidebar from '@/components/layout/Sidebar'

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-brand-light">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64">
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
