'use client'

export function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-brand-dark">{value || '—'}</span>
    </div>
  )
}

export function BoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        {value ? 'Yes' : 'No'}
      </span>
    </div>
  )
}

export function TaxCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  )
}
