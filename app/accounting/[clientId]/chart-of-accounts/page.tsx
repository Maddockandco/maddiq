'use client'

import ChartOfAccounts from '@/components/accounting/ChartOfAccounts'

export default function AccountingChartOfAccountsPage({ params }: { params: { clientId: string } }) {
  return <ChartOfAccounts clientId={params.clientId} />
}
