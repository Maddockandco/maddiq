import TaskList from '@/components/tasks/TaskList'

export default function TasksPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your firm's tasks</p>
        </div>
      </div>
      <TaskList />
    </div>
  )
}
