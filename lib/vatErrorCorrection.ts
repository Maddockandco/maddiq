import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface VatErrorCorrection {
  id: string
  client_id: string
  original_period_start: string
  original_period_end: string
  original_vat_return_id: string | null
  discovered_date: string
  description: string
  box1_adjustment: number
  box4_adjustment: number
  status: 'pending' | 'applied' | 'requires_disclosure' | 'cancelled'
  applied_to_return_id: string | null
  applied_date: string | null
  threshold_at_evaluation: number | null
  net_position_at_evaluation: number | null
  cancellation_reason: string | null
  created_at: string
}

// HMRC Notice 700/45: you can adjust a net error on your next VAT return
// without separate disclosure only if it's below the "reporting threshold" -
// the GREATER of £10,000 or 1% of the Box 6 turnover on the return you're
// correcting it in, capped at an absolute £50,000. Anything above that must
// be disclosed separately (form VAT652), not folded into Box 1/4.
// Source: https://www.gov.uk/guidance/how-to-correct-vat-errors-and-make-adjustments-or-claims
export function disclosureThreshold(box6TurnoverForCorrectingPeriod: number): number {
  const onePercent = Math.round(box6TurnoverForCorrectingPeriod * 0.01 * 100) / 100
  return Math.min(Math.max(10000, onePercent), 50000)
}

export interface NetPositionResult {
  corrections: VatErrorCorrection[]
  netAmount: number // signed: positive = owe HMRC more, negative = HMRC owes the client
  netAmountAbs: number
}

// Multiple pending errors are netted together algebraically (an
// under-declaration can offset an over-declaration) - this is how HMRC
// actually requires errors to be combined when testing against the
// threshold, rather than testing each one in isolation.
export async function getNetPendingPosition(clientId: string, db?: SupabaseClient): Promise<NetPositionResult> {
  const supabase = db || createClient()
  const { data } = await supabase
    .from('vat_error_corrections')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .order('discovered_date', { ascending: true })

  const corrections = (data || []) as VatErrorCorrection[]
  const netAmount = corrections.reduce(
    (sum, c) => sum + (parseFloat(String(c.box1_adjustment)) || 0) - (parseFloat(String(c.box4_adjustment)) || 0),
    0
  )
  const rounded = Math.round(netAmount * 100) / 100

  return { corrections, netAmount: rounded, netAmountAbs: Math.abs(rounded) }
}

export interface CorrectionEvaluation {
  netPosition: NetPositionResult
  threshold: number
  withinThreshold: boolean
  box1Adjustment: number
  box4Adjustment: number
}

// Evaluate all pending corrections against a SPECIFIC return being calculated
// right now (its Box 6 sets the threshold). This does not write anything -
// callers decide whether to actually mark corrections as applied/requiring
// disclosure once the return is genuinely saved, not on every live preview.
export async function evaluateCorrectionsForReturn(clientId: string, box6ForThisPeriod: number, db?: SupabaseClient): Promise<CorrectionEvaluation> {
  const netPosition = await getNetPendingPosition(clientId, db)
  const threshold = disclosureThreshold(box6ForThisPeriod)
  const withinThreshold = netPosition.corrections.length === 0 || netPosition.netAmountAbs <= threshold

  if (!withinThreshold) {
    return { netPosition, threshold, withinThreshold, box1Adjustment: 0, box4Adjustment: 0 }
  }

  const box1Adjustment = netPosition.corrections.reduce((sum, c) => sum + (parseFloat(String(c.box1_adjustment)) || 0), 0)
  const box4Adjustment = netPosition.corrections.reduce((sum, c) => sum + (parseFloat(String(c.box4_adjustment)) || 0), 0)

  return {
    netPosition,
    threshold,
    withinThreshold,
    box1Adjustment: Math.round(box1Adjustment * 100) / 100,
    box4Adjustment: Math.round(box4Adjustment * 100) / 100,
  }
}

// Called when a return with pending corrections actually gets saved/filed -
// marks every corrections as resolved one way or the other, with a snapshot
// of the threshold and net position used to make that call (for audit).
export async function resolvePendingCorrections(
  clientId: string,
  appliedToReturnId: string,
  evaluation: CorrectionEvaluation,
  db?: SupabaseClient
): Promise<void> {
  const supabase = db || createClient()
  const ids = evaluation.netPosition.corrections.map((c) => c.id)
  if (ids.length === 0) return

  await supabase
    .from('vat_error_corrections')
    .update({
      status: evaluation.withinThreshold ? 'applied' : 'requires_disclosure',
      applied_to_return_id: evaluation.withinThreshold ? appliedToReturnId : null,
      applied_date: evaluation.withinThreshold ? new Date().toISOString().slice(0, 10) : null,
      threshold_at_evaluation: evaluation.threshold,
      net_position_at_evaluation: evaluation.netPosition.netAmount,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('client_id', clientId)
}
