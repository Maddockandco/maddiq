import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import React from 'react'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const styles = StyleSheet.create({
  page: { padding: 50, fontSize: 11, fontFamily: 'Helvetica', color: '#343b46' },
  title: { fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 10, textAlign: 'center', marginBottom: 20, color: '#666' },
  section: { marginBottom: 14, lineHeight: 1.5 },
  bold: { fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', borderBottom: 1, borderBottomColor: '#343b46', paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 3, borderBottom: 0.5, borderBottomColor: '#ddd' },
  col1: { width: '40%' },
  col2: { width: '20%', textAlign: 'right' },
  col3: { width: '20%', textAlign: 'right' },
  col4: { width: '20%', textAlign: 'right' },
  signatureBlock: { marginTop: 40 },
  signatureLine: { borderTop: 1, borderTopColor: '#343b46', width: 220, marginTop: 30, paddingTop: 4 },
})

function BoardMinutesDoc({ client, dividend, allocations, directors }: any) {
  const declaredDate = new Date(dividend.declaration_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const classes = Array.from(new Set(allocations.map((a: any) => a.shareholders?.share_class))).join(', ')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>MINUTES OF A MEETING OF THE BOARD OF DIRECTORS</Text>
        <Text style={styles.title}>OF {client.name.toUpperCase()}</Text>
        <Text style={styles.subtitle}>Company Number: {client.company_number || 'N/A'}</Text>

        <View style={styles.section}>
          <Text>Held on: {declaredDate}</Text>
          {client.registered_address && <Text>Registered Office: {client.registered_address}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.bold}>PRESENT:</Text>
          {directors.length > 0 ? directors.map((d: any, i: number) => <Text key={i}>{d.name}, Director</Text>) : <Text>[Directors to be listed]</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.bold}>1. QUORUM</Text>
          <Text>The Chairman confirmed that a quorum of directors was present and that the meeting was duly convened.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.bold}>2. INTERIM DIVIDEND</Text>
          <Text>
            The Board considered the Company's financial position and available distributable reserves, and was
            satisfied that the Company had sufficient distributable profits to declare the dividend set out below.
          </Text>
          <Text style={{ marginTop: 8 }}>
            IT WAS RESOLVED THAT an interim dividend of £{parseFloat(dividend.total_amount).toFixed(2)} be declared
            in respect of the {classes} shares of the Company, payable to the shareholders registered as at{' '}
            {declaredDate} in the amounts set out in the schedule below.
          </Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.col1, styles.bold]}>Shareholder</Text>
          <Text style={[styles.col2, styles.bold]}>Shares</Text>
          <Text style={[styles.col3, styles.bold]}>Class</Text>
          <Text style={[styles.col4, styles.bold]}>Amount</Text>
        </View>
        {allocations.map((a: any) => (
          <View key={a.id} style={styles.tableRow}>
            <Text style={styles.col1}>{a.shareholders?.name}</Text>
            <Text style={styles.col2}>{a.shares_held_at_declaration.toLocaleString()}</Text>
            <Text style={styles.col3}>{a.shareholders?.share_class}</Text>
            <Text style={styles.col4}>£{parseFloat(a.amount).toFixed(2)}</Text>
          </View>
        ))}

        <View style={[styles.section, { marginTop: 20 }]}>
          <Text style={styles.bold}>3. CLOSE</Text>
          <Text>There being no further business, the meeting was closed.</Text>
        </View>

        <View style={styles.signatureBlock}>
          <Text>Signed as a true record of the meeting:</Text>
          <View style={styles.signatureLine}>
            <Text>Director</Text>
            <Text style={{ marginTop: 4 }}>Date: _______________</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

function WrittenResolutionDoc({ client, dividend, allocations }: any) {
  const declaredDate = new Date(dividend.declaration_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const classes = Array.from(new Set(allocations.map((a: any) => a.shareholders?.share_class))).join(', ')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>WRITTEN RESOLUTION OF THE SHAREHOLDERS</Text>
        <Text style={styles.title}>OF {client.name.toUpperCase()}</Text>
        <Text style={styles.subtitle}>Company Number: {client.company_number || 'N/A'}</Text>
        <Text style={styles.subtitle}>Passed pursuant to Part 13 of the Companies Act 2006</Text>

        <View style={styles.section}>
          <Text>
            We, being the shareholders of the Company entitled to vote on the matter set out below, hereby resolve
            as an ordinary resolution, on {declaredDate}:
          </Text>
        </View>

        <View style={styles.section}>
          <Text>
            THAT a final dividend of £{parseFloat(dividend.total_amount).toFixed(2)} be declared in respect of the{' '}
            {classes} shares of the Company, payable to shareholders registered as at {declaredDate} in the amounts
            set out in the schedule below.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={{ fontSize: 9, color: '#666' }}>
            This resolution takes effect when signed by shareholders holding the requisite majority of voting
            rights, in accordance with the Company's articles of association.
          </Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.col1, styles.bold]}>Shareholder</Text>
          <Text style={[styles.col2, styles.bold]}>Shares</Text>
          <Text style={[styles.col3, styles.bold]}>Class</Text>
          <Text style={[styles.col4, styles.bold]}>Amount</Text>
        </View>
        {allocations.map((a: any) => (
          <View key={a.id} style={styles.tableRow}>
            <Text style={styles.col1}>{a.shareholders?.name}</Text>
            <Text style={styles.col2}>{a.shares_held_at_declaration.toLocaleString()}</Text>
            <Text style={styles.col3}>{a.shareholders?.share_class}</Text>
            <Text style={styles.col4}>£{parseFloat(a.amount).toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.signatureBlock}>
          {allocations.map((a: any) => (
            <View key={a.id} style={styles.signatureLine}>
              <Text>{a.shareholders?.name} — {a.shares_held_at_declaration.toLocaleString()} shares</Text>
              <Text style={{ marginTop: 4 }}>Signature: _______________ Date: _______________</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}

export async function GET(request: Request, { params }: { params: { dividendId: string } }) {
  const { data: dividend } = await supabase.from('dividends').select('*').eq('id', params.dividendId).single()
  if (!dividend) return NextResponse.json({ error: 'Dividend not found' }, { status: 404 })

  const [{ data: client }, { data: allocations }, { data: directors }] = await Promise.all([
    supabase.from('clients').select('name, company_number, registered_address').eq('id', dividend.client_id).single(),
    supabase.from('dividend_allocations').select('*, shareholders(name, share_class)').eq('dividend_id', params.dividendId),
    supabase.from('client_contacts').select('name').eq('client_id', dividend.client_id).eq('role', 'director'),
  ])

  const Doc = dividend.declaration_type === 'written_resolution' ? WrittenResolutionDoc : BoardMinutesDoc
  const buffer = await renderToBuffer(
    React.createElement(Doc, { client, dividend, allocations: allocations || [], directors: directors || [] })
  )

  const filename = dividend.declaration_type === 'written_resolution' ? 'written-resolution.pdf' : 'board-minutes.pdf'
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
