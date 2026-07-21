import { createClient } from '@/lib/supabase/client'

// Client onboarding/tax info captures "VAT registered?" + VAT number as a
// quick client-level flag, but VAT Setup (vat_settings) is the table that
// actually drives return calculations, MTD, everything downstream. Without
// this sync, ticking "VAT registered" at onboarding did nothing beyond that
// one field - VAT Setup stayed empty until someone separately filled it in.
//
// This only ever touches vat_registration_number. It never sets scheme,
// filing frequency, or sector on an EXISTING vat_settings row - those are
// genuine accountant judgement calls made in VAT Setup, not something
// onboarding should silently overwrite. A brand new row gets sensible
// defaults (standard scheme, quarterly) purely so it exists and shows up
// under VAT Setup ready to be reviewed/completed properly.
export async function syncVatRegistrationToSettings(params: {
  clientId: string
  firmId: string
  userId: string
  vatRegistered: boolean
  vatNumber: string | null
}) {
  if (!params.vatRegistered) return

  const supabase = createClient()
  const { data: existing } = await supabase
    .from('vat_settings')
    .select('id')
    .eq('client_id', params.clientId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('vat_settings')
      .update({ vat_registration_number: params.vatNumber, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    await supabase.from('vat_settings').insert({
      firm_id: params.firmId,
      client_id: params.clientId,
      vat_registration_number: params.vatNumber,
      scheme: 'standard',
      filing_frequency: 'quarterly',
      stagger_group: 1,
      lct_override: 'auto',
      created_by: params.userId,
    })
  }
}
