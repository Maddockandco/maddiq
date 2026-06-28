import Link from 'next/link'
import PipelineList from '@/components/pipeline/PipelineList'

export default function PipelinePage() {
  return (
    <div>
      <div className="mb-4">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-brand-dark transition">
          ← Back to Dashboard
        </Link>
      </div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">Track your new business leads</p>
        </div>
        <Link
          href="/pipeline/new"
          className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition flex items-center gap-2"
        >
          <span>+</span> Add Lead
        </Link>
      </div>
      <PipelineList />
    </div>
  )
}
