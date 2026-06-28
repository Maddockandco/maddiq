'use client'

export default function TaskTable({ tasks }: { tasks: any[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
      <table className="w-full">
        <thead>
          <tr className="bg-brand-dark">
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Task</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Client</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Priority</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Status</th>
            <th className="text-left px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider">Due Date</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, index) => (
            <tr key={task.id} className={`border-b border-gray-100 hover:bg-amber-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
              <td className="px-6 py-4"><span className="font-medium text-brand-dark text-sm">{task.title}</span></td>
              <td className="px-6 py-4"><span className="text-sm text-gray-500">{task.clients?.name || '—'}</span></td>
              <td className="px-6 py-4">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                  task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                  task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                  task.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-500'
                }`}>{task.priority}</span>
              </td>
              <td className="px-6 py-4">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                  task.status === 'done' ? 'bg-green-100 text-green-700' :
                  task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  task.status === 'blocked' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-500'
                }`}>{task.status.replace('_', ' ')}</span>
              </td>
              <td className="px-6 py-4">
                <span className="text-sm text-gray-500">{task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB') : '—'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
