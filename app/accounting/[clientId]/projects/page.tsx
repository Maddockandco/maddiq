'use client'
import Projects from '@/components/accounting/Projects'

export default function ProjectsPage({ params }: { params: { clientId: string } }) {
  return <Projects clientId={params.clientId} />
}
