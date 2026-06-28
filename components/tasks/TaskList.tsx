'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import TaskTable from '@/components/tasks/TaskTable'

export default function TaskList() {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchTasks() {
      const { data } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, clients(name)')
        .order('due_date', { ascending: true })
      if (data) setTasks(data)
      setLoading(false)
    }
    fetchTasks()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
        <p className="text-gray-500 text-sm">Loading tasks...</p>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
        <h2 className="text-lg font-semibold text-brand-dark mb-2">No tasks yet</h2>
        <p className="text-gray-500 text-sm">Tasks you create will appear here</p>
      </div>
    )
  }

  return <TaskTable tasks={tasks} />
}
