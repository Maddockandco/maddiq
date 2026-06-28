import DeadlineList from '@/components/deadlines/DeadlineList'

export default function DeadlinesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Deadlines</h1>
          <p className="text-sm text-gray-500 mt-1">Track all statutory filing deadlines</p>
        </div>
      </div>
      <DeadlineList />
    </div>
  )
}
