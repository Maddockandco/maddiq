import PageHeader from '@/components/layout/PageHeader'
import DeadlineList from '@/components/deadlines/DeadlineList'

export default function DeadlinesPage() {
  return (
    <div>
      <PageHeader
        title="Deadlines"
        description="Track all statutory filing deadlines"
      />
      <DeadlineList />
    </div>
  )
}
