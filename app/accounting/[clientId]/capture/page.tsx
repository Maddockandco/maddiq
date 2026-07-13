'use client'
import ReceiptCapture from '@/components/accounting/ReceiptCapture'

export default function ReceiptCapturePage({ params }: { params: { clientId: string } }) {
  return <ReceiptCapture clientId={params.clientId} />
}
