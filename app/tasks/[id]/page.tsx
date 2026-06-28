import Link from 'next/link'
import TaskEditForm from '@/components/tasks/TaskEditForm'

export default function TaskPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/tasks" className="text-gray-400 hover:text-brand-dark transition text-sm">
          ← Back to tasks
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-brand-dark mb-8">Edit Task</h1>
      <TaskEditForm taskId={params.id} />
    </div>
  )
}
