import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const companyNameIncludes = searchParams.get('company_name_includes')
  const sicCodes = searchParams.get('sic_codes') // comma-delimited, e.g. "68100,68209,68320"
  const companyStatus = searchParams.get('company_status') // e.g. "active"
  const location = searchParams.get('location')
  const size = searchParams.get('size') || '50'

  if (!companyNameIncludes && !sicCodes && !location) {
    return NextResponse.json({ error: 'At least one of company_name_includes, sic_codes, or location is required' }, { status: 400 })
  }

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not found in environment' }, { status: 500 })
  }

  const credentials = Buffer.from(`${apiKey}:`).toString('base64')

  const params = new URLSearchParams()
  if (companyNameIncludes) params.set('company_name_includes', companyNameIncludes)
  if (sicCodes) params.set('sic_codes', sicCodes)
  if (companyStatus) params.set('company_status', companyStatus)
  if (location) params.set('location', location)
  params.set('size', size)

  try {
    const searchRes = await fetch(
      `https://api.company-information.service.gov.uk/advanced-search/companies?${params.toString()}`,
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Accept': 'application/json',
        },
        cache: 'no-store',
      }
    )

    const responseText = await searchRes.text()
    if (!searchRes.ok) {
      return NextResponse.json({
        error: `CH API returned ${searchRes.status}`,
        body: responseText,
      }, { status: 400 })
    }

    const results = JSON.parse(responseText)

    const companies = (results.items || []).map((item: any) => ({
      company_number: item.company_number,
      title: item.company_name,
      status: item.company_status,
      address_snippet: [
        item.registered_office_address?.address_line_1,
        item.registered_office_address?.locality,
        item.registered_office_address?.postal_code,
      ].filter(Boolean).join(', '),
      date_of_creation: item.date_of_creation,
      sic_codes: item.sic_codes || [],
    }))

    return NextResponse.json({ companies, hits: results.hits })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
