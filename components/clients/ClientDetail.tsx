<div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <a href={`/clients/${client.id}/tasks`} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-50 hover:bg-brand-light text-sm font-medium text-brand-dark transition">
              ✅ Add Task
            </a>
            <a href={`/clients/${client.id}/documents`} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-50 hover:bg-brand-light text-sm font-medium text-brand-dark transition">
              📄 Upload Document
            </a>
            <a href={`/clients/${client.id}/notes`} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-50 hover:bg-brand-light text-sm font-medium text-brand-dark transition">
              📝 Add Note
            </a>
            <a href={`/clients/${client.id}/engagements`} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-50 hover:bg-brand-light text-sm font-medium text-brand-dark transition">
              📋 Add Engagement
            </a>
            <PortalInvite clientId={client.id} clientName={client.name} />
          </div>
        </div>
