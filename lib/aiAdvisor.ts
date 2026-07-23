import { SupabaseClient } from '@supabase/supabase-js'

// Mirrors the same 4-bucket classification already used in lib/industryDetection.ts
export const INDUSTRY_PERSONAS: Record<string, string> = {
  hospitality:
    'This client operates in hospitality (restaurants, cafes, bars, hotels, catering). Pay particular attention to: tips and troncs treatment (National Insurance implications differ from wages), seasonal cashflow swings, the VAT treatment of food/drink (standard vs zero-rated depending on what and how it is consumed), and alcohol licensing costs.',
  construction:
    'This client operates in construction. Pay particular attention to: CIS (Construction Industry Scheme) deductions and subcontractor verification, the domestic reverse charge for VAT on construction services, correct employment status classification for subcontractors, and retention accounting on contracts.',
  property:
    'This client operates in property / letting. Pay particular attention to: Section 24 mortgage interest restriction (relief given as a basic-rate tax credit, not a deduction), the distinction between a standard let and a Furnished Holiday Letting (different tax treatment), capital allowances on furnishings for FHLs, and SDLT on acquisitions.',
  general:
    'This client is a general trading or professional services business. Reason from standard UK corporation tax and VAT principles.',
}

// Hand-written, defensible starting knowledge - not AI-generated, so these
// don't need to sit in the review queue. Used as a fallback whenever a
// firm's own accumulated (accountant-approved) knowledge for an industry is
// still empty, e.g. for a brand new firm with no history yet.
const DEFAULT_INDUSTRY_KNOWLEDGE: Record<string, string[]> = {
  hospitality: [
    'Tronc payments (tips distributed via a troncmaster) can be exempt from employer NI if structured correctly, unlike tips paid directly through payroll.',
    'Staff meals provided free or at a discount can have benefit-in-kind implications depending on how they are provided.',
  ],
  construction: [
    'A subcontractor with "gross payment status" under CIS is paid without deduction, but the contractor still has monthly verification and reporting obligations.',
    'The VAT domestic reverse charge applies to most construction services between VAT-registered businesses - the customer accounts for VAT, not the supplier.',
  ],
  property: [
    'Since April 2020, individual landlords cannot deduct mortgage interest from rental income - they instead get a basic-rate tax credit on that interest, which can push some landlords into paying tax on a loss in cash terms.',
    'Furnished Holiday Lettings have distinct tax treatment (capital allowances on furnishings, different loss relief rules) but must meet specific let, availability, and occupation thresholds each year to qualify.',
  ],
  general: [],
}

export interface ClientFinancialContext {
  clientName: string
  industry: string
  vatScheme: string | null
  vatRegistrationNumber: string | null
  yearEndDate: string | null
  recentVatReturns: { period: string; netVat: number; scheme: string }[]
  outstandingDebtors: number
  outstandingCreditors: number
  turnoverLast12Months: number
  purchasesLast12Months: number
  dividendsThisTaxYear: number
}

function currentUkTaxYearStart(): string {
  const now = new Date()
  const year = now.getMonth() > 2 || (now.getMonth() === 2 && now.getDate() >= 6) ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-04-06`
}

// Deliberately grounded in the same trusted totals already shown elsewhere
// in the app (invoice/bill totals) rather than re-deriving from raw journal
// debits/credits - safer under time pressure, and consistent with numbers
// the accountant already trusts. This is a turnover/spend snapshot, not a
// full P&L with cost-of-sales/overhead breakdown.
export async function buildClientFinancialContext(clientId: string, db: SupabaseClient, industry: string): Promise<ClientFinancialContext> {
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
  const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().slice(0, 10)
  const taxYearStart = currentUkTaxYearStart()

  const [clientRes, vatSettingsRes, vatReturnsRes, invoicesRes, billsRes, dividendsRes] = await Promise.all([
    db.from('clients').select('name, year_end_date').eq('id', clientId).single(),
    db.from('vat_settings').select('scheme, vat_registration_number').eq('client_id', clientId).maybeSingle(),
    db.from('vat_returns').select('period_start, period_end, box5_net_vat, scheme_at_filing').eq('client_id', clientId).eq('status', 'filed').order('period_end', { ascending: false }).limit(3),
    db.from('sales_invoices').select('total, amount_paid, status, invoice_date').eq('client_id', clientId).not('status', 'in', '(draft,cancelled,void)'),
    db.from('purchase_bills').select('total, amount_paid, status, bill_date').eq('client_id', clientId).not('status', 'in', '(draft,cancelled,void)'),
    db.from('dividends').select('total_amount, declaration_date, status').eq('client_id', clientId).in('status', ['declared', 'paid']).gte('declaration_date', taxYearStart),
  ])

  const outstandingDebtors = (invoicesRes.data || [])
    .filter((i: any) => ['awaiting_payment', 'partially_paid'].includes(i.status))
    .reduce((sum: number, i: any) => sum + (parseFloat(i.total) - parseFloat(i.amount_paid)), 0)

  const outstandingCreditors = (billsRes.data || [])
    .filter((b: any) => ['awaiting_payment', 'partially_paid'].includes(b.status))
    .reduce((sum: number, b: any) => sum + (parseFloat(b.total) - parseFloat(b.amount_paid)), 0)

  const turnoverLast12Months = (invoicesRes.data || [])
    .filter((i: any) => i.invoice_date >= twelveMonthsAgoStr)
    .reduce((sum: number, i: any) => sum + parseFloat(i.total), 0)

  const purchasesLast12Months = (billsRes.data || [])
    .filter((b: any) => b.bill_date >= twelveMonthsAgoStr)
    .reduce((sum: number, b: any) => sum + parseFloat(b.total), 0)

  const dividendsThisTaxYear = (dividendsRes.data || []).reduce((sum: number, d: any) => sum + parseFloat(d.total_amount), 0)

  return {
    clientName: clientRes.data?.name || 'Unknown client',
    industry,
    vatScheme: vatSettingsRes.data?.scheme || null,
    vatRegistrationNumber: vatSettingsRes.data?.vat_registration_number || null,
    yearEndDate: clientRes.data?.year_end_date || null,
    recentVatReturns: (vatReturnsRes.data || []).map((r: any) => ({
      period: `${r.period_start} to ${r.period_end}`,
      netVat: parseFloat(r.box5_net_vat),
      scheme: r.scheme_at_filing,
    })),
    outstandingDebtors: Math.round(outstandingDebtors * 100) / 100,
    outstandingCreditors: Math.round(outstandingCreditors * 100) / 100,
    turnoverLast12Months: Math.round(turnoverLast12Months * 100) / 100,
    purchasesLast12Months: Math.round(purchasesLast12Months * 100) / 100,
    dividendsThisTaxYear: Math.round(dividendsThisTaxYear * 100) / 100,
  }
}

export async function getApprovedIndustryKnowledge(firmId: string, industry: string, db: SupabaseClient): Promise<string[]> {
  const { data } = await db
    .from('ai_advisor_industry_knowledge')
    .select('insight')
    .eq('firm_id', firmId)
    .eq('industry', industry)
    .eq('status', 'approved')

  const accumulated = (data || []).map((r: any) => r.insight)
  if (accumulated.length > 0) return accumulated
  return DEFAULT_INDUSTRY_KNOWLEDGE[industry] || []
}

export function buildSystemPrompt(context: ClientFinancialContext, industryKnowledge: string[]): string {
  return `You are an AI business and tax advisor helping a UK accountant think through their client's position. You are NOT a substitute for the accountant's own professional judgement, and you must say so whenever giving anything that resembles formal tax advice.

${INDUSTRY_PERSONAS[context.industry] || INDUSTRY_PERSONAS.general}

Client: ${context.clientName}
VAT scheme: ${context.vatScheme || 'not set'} ${context.vatRegistrationNumber ? `(VRN ${context.vatRegistrationNumber})` : ''}
Year end: ${context.yearEndDate || 'not set'}
Turnover, last 12 months: £${context.turnoverLast12Months.toFixed(2)}
Purchases, last 12 months: £${context.purchasesLast12Months.toFixed(2)}
Outstanding debtors: £${context.outstandingDebtors.toFixed(2)}
Outstanding creditors: £${context.outstandingCreditors.toFixed(2)}
Dividends declared this UK tax year: £${context.dividendsThisTaxYear.toFixed(2)}
Recent filed VAT returns: ${context.recentVatReturns.length === 0 ? 'none on record' : context.recentVatReturns.map((r) => `${r.period} (${r.scheme}): £${r.netVat.toFixed(2)} net VAT`).join('; ')}

${industryKnowledge.length > 0 ? `Accumulated knowledge for this industry, from past reviewed conversations:\n${industryKnowledge.map((k) => `- ${k}`).join('\n')}` : ''}

Rules:
- Only reason from the data given above. If something material is missing to answer well, say so explicitly rather than guessing or assuming a typical figure.
- Be concrete and specific where the data supports it - cite the actual numbers given.
- Flag genuine tax-saving opportunities or risks when they're relevant, even if not directly asked.
- Never state something as settled HMRC policy unless you are confident - flag genuine uncertainty and suggest the accountant verify against current HMRC guidance.
- Keep answers proportionate - a quick question deserves a quick answer, not an essay.`
}

export async function extractGeneralizableInsight(userMessage: string, assistantReply: string): Promise<string | null> {
  const prompt = `A UK accountant just asked an AI advisor a question about one specific client, and got this reply. Is there a genuinely generalizable insight here - something true for OTHER clients in the same industry, not specific to this one client's numbers?

Question: ${userMessage}
Reply: ${assistantReply}

If yes, state the generalizable insight in one factual sentence, with no reference to this specific client. If no genuinely generalizable insight exists, respond with exactly: NONE`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  const text = data.content?.find((c: any) => c.type === 'text')?.text?.trim()
  if (!text || text === 'NONE') return null
  return text
}
