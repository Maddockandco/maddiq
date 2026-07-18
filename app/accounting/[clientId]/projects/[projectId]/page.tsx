'use client'
import ProjectDetail from '@/components/accounting/ProjectDetail'

export default function ProjectDetailPage({ params }: { params: { clientId: string; projectId: string } }) {
  return <ProjectDetail clientId={params.clientId} projectId={params.projectId} />
}
