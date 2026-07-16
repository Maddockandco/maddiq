import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 })
  }

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not found in environment' }, { status: 500 })
  }

  const credentials = Buffer.from(`${apiKey}:`).toString('base64')

  try {
    const searchRes = await fetch(
      `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(query.trim())}&items_per_page=50`,
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
      title: item.title,
      status: item.company_status,
      address_snippet: item.address_snippet,
      date_of_creation: item.date_of_creation,
    }))

    return NextResponse.json({ companies })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
