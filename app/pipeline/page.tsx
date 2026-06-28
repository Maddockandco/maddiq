import PageHeader from '@/components/layout/PageHeader'
import PipelineList from '@/components/pipeline/PipelineList'

export default function PipelinePage() {
  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Track your new business leads"
        action={{ label: 'Add Lead', href: '/pipeline/new' }}
      />
      <PipelineList />
    </div>
  )
}
