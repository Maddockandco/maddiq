import ProposalList from '@/components/proposals/ProposalList'

export default function ProposalsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-dark">Proposals</h1>
        <p className="text-sm text-gray-500 mt-1">Accepted quotes and the services agreed with each client</p>
      </div>
      <ProposalList />
    </div>
  )
}
