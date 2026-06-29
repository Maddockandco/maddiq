import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const companyNumber = searchParams.get('company_number')

  if (!companyNumber) {
    return NextResponse.json({ error: 'Company number required' }, { status: 400 })
  }

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY
  const credentials = Buffer.from(`${apiKey}:`).toString('base64')

  try {
    // Fetch company details
    const [companyRes, officersRes] = await Promise.all([
      fetch(`https://api.company-information.service.gov.uk/company/${companyNumber}`, {
        headers: { Authorization: `Basic ${credentials}` },
      }),
      fetch(`https://api.company-information.service.gov.uk/company/${companyNumber}/officers`, {
        headers: { Authorization: `Basic ${credentials}` },
      }),
    ])

    if (!companyRes.ok) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const company = await companyRes.json()
    const officers = officersRes.ok ? await officersRes.json() : { items: [] }

    // Extract active directors only
    const directors = officers.items
      ?.filter((o: any) => !o.resigned_on && o.officer_role === 'director')
      ?.map((d: any) => ({
        name: d.name,
        role: 'director',
        appointment_date: d.appointed_on,
        date_of_birth: d.date_of_birth
          ? `${d.date_of_birth.year}-${String(d.date_of_birth.month).padStart(2, '0')}`
          : null,
      })) || []

    return NextResponse.json({
      company_number: company.company_number,
      name: company.company_name,
      status: company.company_status,
      type: company.type,
      incorporated_on: company.date_of_creation,
      sic_codes: company.sic_codes,
      registered_address: [
        company.registered_office_address?.address_line_1,
        company.registered_office_address?.address_line_2,
        company.registered_office_address?.locality,
        company.registered_office_address?.region,
        company.registered_office_address?.postal_code,
      ].filter(Boolean).join(', '),
      accounting_reference_date: company.accounts?.accounting_reference_date
        ? `${company.accounts.accounting_reference_date.day}/${company.accounts.accounting_reference_date.month}`
        : null,
      next_accounts_due: company.accounts?.next_due,
      next_confirmation_due: company.confirmation_statement?.next_due,
      directors,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
