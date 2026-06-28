'use client'

export function Field({ label, value, setter, type = 'text', placeholder = '' }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-dark mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => setter(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
      />
    </div>
  )
}

export function Toggle({ label, value, setter }: any) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => setter(e.target.checked)}
        className="w-4 h-4 accent-brand-dark"
      />
      <span className="text-sm font-medium text-brand-dark">{label}</span>
    </label>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-brand-dark uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  )
}
