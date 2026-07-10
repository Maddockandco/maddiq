import { NextRequest, NextResponse } from 'next/server'
import { listAspsps } from '@/lib/enableBanking'

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get('country') || 'GB'
  try {
    const filtered = await listAspsps(country)
    const filteredList = filtered.aspsps || []

    if (filteredList.length > 0) {
      return NextResponse.json({ aspsps: filteredList, source: 'country_filtered' })
    }

    // Nothing came back for this country — try completely unfiltered as a diagnostic fallback,
    // in case Mock ASPSP (or other sandbox banks) aren't tagged under this country code.
    const unfiltered = await listAspsps('')
    return NextResponse.json({ aspsps: unfiltered.aspsps || [], source: 'unfiltered_fallback' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
