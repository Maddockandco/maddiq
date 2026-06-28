import Link from 'next/link'
import TaskForm from '@/components/tasks/TaskForm'

export default function NewTaskPage() {
  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/tasks" className="text-gray-400 hover:text-brand-dark transition text-sm">
          ← Back to tasks
        </Link>
      </div>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-brand-dark mb-8">Add new task</h1>
        <TaskForm />
      </div>
    </div>
  )
}
