import PageHeader from '@/components/layout/PageHeader'
import TaskList from '@/components/tasks/TaskList'

export default function TasksPage() {
  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Manage your firm's tasks"
        action={{ label: 'Add Task', href: '/tasks/new' }}
      />
      <TaskList />
    </div>
  )
}
