import Link from 'next/link'
import PipelineForm from '@/components/pipeline/PipelineForm'

export default function NewLeadPage() {
  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link href="/pipeline" className="text-gray-400 hover:text-brand-dark transition text-sm">
          ← Back to pipeline
        </Link>
      </div>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-brand-dark mb-8">Add new lead</h1>
        <PipelineForm />
      </div>
    </div>
  )
}
