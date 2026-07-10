import { NextRequest, NextResponse } from 'next/server'
import { listAspsps } from '@/lib/enableBanking'

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get('country') || 'GB'
  try {
    const data = await listAspsps(country)
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
