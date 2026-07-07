'use client'
import BankTransactions from '@/components/accounting/BankTransactions'

export default function BankTransactionsPage({ params }: { params: { clientId: string } }) {
  return <BankTransactions clientId={params.clientId} />
}
