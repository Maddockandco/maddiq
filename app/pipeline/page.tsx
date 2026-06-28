import PipelineList from '@/components/pipeline/PipelineList'

export default function PipelinePage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">Track your new business leads</p>
        </div>
      </div>
      <PipelineList />
    </div>
  )
}
