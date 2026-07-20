import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import React from 'react'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY)

const styles = StyleSheet.create({
  page: { padding: 50, fontSize: 11, fontFamily: 'Helvetica', color: '#343b46' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#666', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  label: { fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value: { fontSize: 11 },
  tableHeader: { flexDirection: 'row', borderBottom: 1, borderBottomColor: '#343b46', paddingBottom: 4, marginBottom: 4, marginTop: 20 },
  tableRow: { flexDirection: 'row', paddingVertical: 4, borderBottom: 0.5, borderBottomColor: '#ddd' },
  col1: { width: '46%' },
  col2: { width: '12%', textAlign: 'right' },
  col3: { width: '20%', textAlign: 'right' },
  col4: { width: '22%', textAlign: 'right' },
  totalsBlock: { marginTop: 12, alignItems: 'flex-end' },
  totalsRow: { flexDirection: 'row', width: 200, justifyContent: 'space-between', paddingVertical: 2 },
  grandTotal: { flexDirection: 'row', width: 200, justifyContent: 'space-between', paddingTop: 6, borderTop: 1, borderTopColor: '#343b46' },
})

function InvoiceDoc({ client, invoice, lines }: any) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{client.name}</Text>
        <Text style={styles.subtitle}>INVOICE {invoice.invoice_number}</Text>

        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Billed To</Text>
            <Text style={styles.value}>{invoice.contacts?.name}</Text>
          </View>
          <View>
            <Text style={styles.label}>Invoice Date</Text>
            <Text style={styles.value}>{new Date(invoice.invoice_date).toLocaleDateString('en-GB')}</Text>
          </View>
          <View>
            <Text style={styles.label}>Due Date</Text>
            <Text style={styles.value}>{new Date(invoice.due_date).toLocaleDateString('en-GB')}</Text>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.col1, { fontWeight: 'bold' }]}>Description</Text>
          <Text style={[styles.col2, { fontWeight: 'bold' }]}>Qty</Text>
          <Text style={[styles.col3, { fontWeight: 'bold' }]}>Unit Price</Text>
          <Text style={[styles.col4, { fontWeight: 'bold' }]}>Amount</Text>
        </View>
        {lines.map((l: any) => (
          <View key={l.id} style={styles.tableRow}>
            <Text style={styles.col1}>{l.description}</Text>
            <Text style={styles.col2}>{l.quantity}</Text>
            <Text style={styles.col3}>£{parseFloat(l.unit_price).toFixed(2)}</Text>
            <Text style={styles.col4}>£{(parseFloat(l.line_total) + parseFloat(l.vat_amount)).toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text>Subtotal</Text>
            <Text>£{parseFloat(invoice.subtotal).toFixed(2)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>VAT</Text>
            <Text>£{parseFloat(invoice.vat_total).toFixed(2)}</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text style={{ fontWeight: 'bold' }}>Total Due</Text>
            <Text style={{ fontWeight: 'bold' }}>£{parseFloat(invoice.total).toFixed(2)}</Text>
          </View>
        </View>

        {invoice.notes && (
          <View style={{ marginTop: 30 }}>
            <Text style={styles.label}>Notes</Text>
            <Text style={{ fontSize: 10, color: '#666' }}>{invoice.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  )
}

export async function POST(request: Request) {
  const { invoiceId } = await request.json()
  if (!invoiceId) return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })

  const { data: invoice, error: invoiceError } = await supabase
    .from('sales_invoices')
    .select('*, contacts(name, email)')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (!invoice.contacts?.email) return NextResponse.json({ error: 'This customer has no email address on file - add one in Contacts first' }, { status: 400 })

  const [{ data: client }, { data: lines }] = await Promise.all([
    supabase.from('clients').select('name').eq('id', invoice.client_id).single(),
    supabase.from('sales_invoice_lines').select('*').eq('invoice_id', invoiceId).order('sort_order'),
  ])

  const pdfBuffer = await renderToBuffer(
    React.createElement(InvoiceDoc, { client, invoice, lines: lines || [] })
  )

  const { error: sendError } = await resend.emails.send({
    from: 'hello@maddockandco.com',
    to: invoice.contacts.email,
    subject: `Invoice ${invoice.invoice_number} from ${client?.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #343b46;">Invoice ${invoice.invoice_number} from ${client?.name}</h2>
        <p>Hi ${invoice.contacts.name},</p>
        <p>Please find your invoice attached, totalling <strong>£${parseFloat(invoice.total).toFixed(2)}</strong>, due by <strong>${new Date(invoice.due_date).toLocaleDateString('en-GB')}</strong>.</p>
      </div>
    `,
    attachments: [
      {
        filename: `Invoice-${invoice.invoice_number}.pdf`,
        content: pdfBuffer.toString('base64'),
      },
    ],
  })

  if (sendError) return NextResponse.json({ error: sendError.message }, { status: 500 })

  if (invoice.status === 'draft') {
    await supabase.from('sales_invoices').update({ status: 'awaiting_payment' }).eq('id', invoiceId)
  }

  return NextResponse.json({ success: true })
}
