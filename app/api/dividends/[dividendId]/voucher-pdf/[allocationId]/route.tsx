import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import React from 'react'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const styles = StyleSheet.create({
  page: { padding: 50, fontSize: 11, fontFamily: 'Helvetica', color: '#343b46' },
  card: { border: 1, borderColor: '#c9af69', borderRadius: 4, padding: 24 },
  label: { fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 12, marginBottom: 12 },
  title: { fontSize: 9, color: '#666', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  companyName: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottom: 0.5, borderBottomColor: '#eee' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 4 },
})

function VoucherDoc({ client, dividend, allocation }: any) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.card}>
          <Text style={styles.title}>Dividend Voucher</Text>
          <Text style={styles.companyName}>{client.name}</Text>

          <View style={styles.row}>
            <Text>Voucher Number</Text>
            <Text style={{ fontFamily: 'Courier' }}>{allocation.voucher_number}</Text>
          </View>
          <View style={styles.row}>
            <Text>Shareholder</Text>
            <Text>{allocation.shareholders?.name}</Text>
          </View>
          <View style={styles.row}>
            <Text>Share Class</Text>
            <Text>{allocation.shareholders?.share_class}</Text>
          </View>
          <View style={styles.row}>
            <Text>Shares Held</Text>
            <Text>{allocation.shares_held_at_declaration.toLocaleString()}</Text>
          </View>
          <View style={styles.row}>
            <Text>Declaration Date</Text>
            <Text>{new Date(dividend.declaration_date).toLocaleDateString('en-GB')}</Text>
          </View>
          <View style={styles.row}>
            <Text>Rate Per Share</Text>
            <Text>£{parseFloat(dividend.per_share_amount).toFixed(4)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={{ fontWeight: 'bold' }}>Dividend Amount</Text>
            <Text style={{ fontWeight: 'bold' }}>£{parseFloat(allocation.amount).toFixed(2)}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 8, color: '#999', marginTop: 20, textAlign: 'center' }}>
          This voucher should be retained for tax purposes.
        </Text>
      </Page>
    </Document>
  )
}

export async function GET(request: Request, { params }: { params: { dividendId: string; allocationId: string } }) {
  const { data: dividend } = await supabase.from('dividends').select('*').eq('id', params.dividendId).single()
  if (!dividend) return NextResponse.json({ error: 'Dividend not found' }, { status: 404 })

  const [{ data: client }, { data: allocation }] = await Promise.all([
    supabase.from('clients').select('name').eq('id', dividend.client_id).single(),
    supabase.from('dividend_allocations').select('*, shareholders(name, share_class)').eq('id', params.allocationId).single(),
  ])

  if (!allocation) return NextResponse.json({ error: 'Allocation not found' }, { status: 404 })

  const buffer = await renderToBuffer(React.createElement(VoucherDoc, { client, dividend, allocation }))

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="dividend-voucher-${allocation.voucher_number}.pdf"`,
    },
  })
}
