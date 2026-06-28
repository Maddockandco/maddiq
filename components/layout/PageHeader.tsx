import Link from 'next/link'

type Props = {
  title: string
  description?: string
  action?: { label: string; href: string }
}

export default function PageHeader({ title, description, action }: Props) {
  return (
    <div className="mb-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg bg-brand-dark text-white text-xs font-medium hover:bg-opacity-90 transition"
      >
        ⬅ Dashboard
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">{title}</h1>
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition flex items-center gap-2"
          >
            + {action.label}
          </Link>
        )}
      </div>
    </div>
  )
}
