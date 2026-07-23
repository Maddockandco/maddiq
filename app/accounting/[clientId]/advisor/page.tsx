'use client'
import AiAdvisor from '@/components/accounting/AiAdvisor'

export default function AdvisorPage({ params }: { params: { clientId: string } }) {
  return <AiAdvisor clientId={params.clientId} />
}
