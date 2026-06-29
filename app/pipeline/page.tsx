'use client'

import PipelineList from '@/components/pipeline/PipelineList'
import { useRole } from '@/hooks/useRole'
import Link from 'next/link'

export default function PipelinePage() {
  const { can } = useRole()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">Track your leads and prospects</p>
        </div>
        {can.managePipeline && (
          <Link
            href="/pipeline/new"
            className="bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-opacity-90 transition"
          >
            + Add Lead
          </Link>
        )}
      </div>
      <PipelineList />
    </div>
  )
}
