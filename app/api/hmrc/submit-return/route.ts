import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidAccessToken, buildFraudPreventionHeaders, submitVatReturn, VatSubmissionPayload } from '@/lib/hmrc'
import { ClientFraudPreventionData } from '@/lib/hmrcFraudPreventionClient'
import { calculateVatReturn, calculateVatReturnCashBasis, calculateVatReturnFlatRate, VatReturnResult } from '@/lib/vatReturn'
import { evaluateCorrectionsForReturn, resolvePendingCorrections } from '@/lib/vatErrorCorrection'

export async function POST(req: NextRequest) {
  const { clientId, periodStart, periodEnd, obligationPeriodKey, fraudPreventionData, notes } = (await req.json()) as {
    clientId: string
    periodStart: string
    periodEnd: string
    obligationPeriodKey: string
    fraudPreventionData: ClientFraudPreventionData
    notes?: string | null
  }

  if (!clientId || !periodStart || !periodEnd || !obligationPeriodKey || !fraudPreventionData) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const authHeader = req.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!bearerToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: firmUser } = await supabase.from('firm_users').select('firm_id').eq('user_id', user.id).single()
  if (!firmUser) {
    return NextResponse.json({ error: 'Could not find your firm' }, { status: 400 })
  }

  const { data: connection } = await supabase
    .from('hmrc_connections')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .maybeSingle()

  if (!connection) {
    return NextResponse.json({ error: 'Not connected to HMRC for this client' }, { status: 400 })
  }

  const { data: settings } = await supabase.from('vat_settings').select('*').eq('client_id', clientId).maybeSingle()
  if (!settings) {
    return NextResponse.json({ error: 'No VAT Setup found for this client' }, { status: 400 })
  }

  try {
    // Recalculate live, right at submission time - never trust a stale figure
    let calc: VatReturnResult & { appliedPercentage?: number }
    if (settings.scheme === 'cash_accounting') {
      calc = await calculateVatReturnCashBasis(clientId, periodStart, periodEnd)
    } else if (settings.scheme === 'flat_rate') {
      calc = await calculateVatReturnFlatRate(clientId, periodStart, periodEnd, {
        sector: settings.flat_rate_sector || null,
        registrationDate: settings.registration_date || null,
        lctOverride: settings.lct_override || 'auto',
      })
    } else {
      calc = await calculateVatReturn(clientId, periodStart, periodEnd)
    }

    const evaluation = await evaluateCorrectionsForReturn(clientId, calc.box6TotalSalesExVat)
    const correctionsApplied = evaluation.netPosition.corrections.length > 0 && evaluation.withinThreshold
    const box1Total = calc.box1VatOnSales + (correctionsApplied ? evaluation.box1Adjustment : 0)
    const box4Total = calc.box4VatReclaimed + (correctionsApplied ? evaluation.box4Adjustment : 0)
    const box2Total = 0 // NI EU acquisitions - not tracked, always 0 for the vast majority of GB clients
    const box3Total = box1Total + box2Total
    const box5Total = box3Total - box4Total

    if (evaluation.netPosition.corrections.length > 0 && !evaluation.withinThreshold) {
      return NextResponse.json(
        {
          error: `Pending error corrections (net £${evaluation.netPosition.netAmountAbs.toFixed(2)}) exceed the disclosure threshold (£${evaluation.threshold.toFixed(2)}) for this period. These must be reported to HMRC separately via VAT652, not included in this submission. Resolve or cancel them in Error Corrections before submitting.`,
        },
        { status: 400 }
      )
    }

    const accessToken = await getValidAccessToken(connection, async (tokens) => {
      await supabase.from('hmrc_connections').update({ ...tokens, updated_at: new Date().toISOString() }).eq('id', connection.id)
    })

    const clientPublicIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || ''
    const fraudHeaders = await buildFraudPreventionHeaders(fraudPreventionData, { clientPublicIp, userId: user.id })

    const payload: VatSubmissionPayload = {
      periodKey: obligationPeriodKey,
      vatDueSales: Math.round(box1Total * 100) / 100,
      vatDueAcquisitions: box2Total,
      totalVatDue: Math.round(box3Total * 100) / 100,
      vatReclaimedCurrPeriod: Math.round(box4Total * 100) / 100,
      netVatDue: Math.round(Math.abs(box5Total) * 100) / 100,
      totalValueSalesExVAT: Math.round(calc.box6TotalSalesExVat),
      totalValuePurchasesExVAT: Math.round(calc.box7TotalPurchasesExVat),
      totalValueGoodsSuppliedExVAT: 0,
      totalAcquisitionsExVAT: 0,
      finalised: true,
    }

    const hmrcResponse = await submitVatReturn(connection.vrn, accessToken, fraudHeaders, payload)

    const { data: saved, error: saveError } = await supabase
      .from('vat_returns')
      .insert({
        firm_id: firmUser.firm_id,
        client_id: clientId,
        period_start: periodStart,
        period_end: periodEnd,
        box1_vat_on_sales: payload.vatDueSales,
        box2_vat_on_eu_acquisitions: payload.vatDueAcquisitions,
        box3_total_vat_due: payload.totalVatDue,
        box4_vat_reclaimed: payload.vatReclaimedCurrPeriod,
        box5_net_vat: payload.netVatDue,
        box6_total_sales_ex_vat: payload.totalValueSalesExVAT,
        box7_total_purchases_ex_vat: payload.totalValuePurchasesExVAT,
        box8_eu_goods_supplied: payload.totalValueGoodsSuppliedExVAT,
        box9_eu_goods_acquired: payload.totalAcquisitionsExVAT,
        status: 'filed',
        filed_date: new Date().toISOString().slice(0, 10),
        scheme_at_filing: settings.scheme,
        flat_rate_percentage_applied: calc.appliedPercentage ?? null,
        hmrc_form_bundle_number: hmrcResponse.formBundleNumber,
        hmrc_processing_date: hmrcResponse.processingDate,
        obligation_period_key: obligationPeriodKey,
        notes: notes || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (saveError) {
      // HMRC accepted it but we failed to save locally - surface this clearly
      // rather than silently losing the record of a real submission.
      return NextResponse.json(
        { error: `HMRC accepted the submission (bundle ${hmrcResponse.formBundleNumber}) but saving it locally failed: ${saveError.message}. Record this reference manually.` },
        { status: 500 }
      )
    }

    if (calc.lineRefs && calc.lineRefs.length > 0) {
      await supabase.from('vat_return_line_snapshots').insert(
        calc.lineRefs.map((ref) => ({
          firm_id: firmUser.firm_id,
          client_id: clientId,
          vat_return_id: saved.id,
          source_table: ref.sourceTable,
          source_line_id: ref.sourceLineId,
          box_type: ref.boxType,
          net_amount: ref.netAmount,
          vat_amount: ref.vatAmount,
        }))
      )
    }

    if (correctionsApplied) {
      await resolvePendingCorrections(clientId, saved.id, evaluation)
    }

    await supabase.rpc('log_accounting_audit', {
      p_client_id: clientId,
      p_entity_type: 'vat_return',
      p_entity_id: saved.id,
      p_action: 'submitted_to_hmrc',
      p_old_data: null,
      p_new_data: saved,
      p_description: `VAT Return for period ${periodStart} to ${periodEnd} submitted to HMRC — bundle ${hmrcResponse.formBundleNumber}, net ${box5Total >= 0 ? 'payable' : 'reclaimable'} £${Math.abs(box5Total).toFixed(2)}`,
    })

    return NextResponse.json({ return: saved, hmrcResponse })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
