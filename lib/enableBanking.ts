import jwt from 'jsonwebtoken'

const APP_ID = process.env.ENABLE_BANKING_APP_ID!
const PRIVATE_KEY = (process.env.ENABLE_BANKING_PRIVATE_KEY || '')
  .trim()
  .replace(/^"(.*)"$/, '$1') // strip accidental surrounding quotes
  .replace(/\\n/g, '\n')
const API_BASE = 'https://api.enablebanking.com'

function buildJWT() {
  if (!PRIVATE_KEY.includes('BEGIN') || !PRIVATE_KEY.includes('PRIVATE KEY')) {
    throw new Error(
      'ENABLE_BANKING_PRIVATE_KEY does not look like a valid PEM key (missing "BEGIN...PRIVATE KEY" header). Check the Vercel environment variable value matches the downloaded key file exactly.'
    )
  }
  const iat = Math.floor(Date.now() / 1000)
  return jwt.sign(
    {
      iss: 'enablebanking.com',
      aud: 'api.enablebanking.com',
      iat,
      exp: iat + 3600, // 1 hour — well under their 24h max
    },
    PRIVATE_KEY,
    {
      algorithm: 'RS256',
      header: { alg: 'RS256', typ: 'JWT', kid: APP_ID },
    }
  )
}

async function enableBankingFetch(path: string, options: RequestInit = {}) {
  const token = buildJWT()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })

  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }

  if (!res.ok) {
    const message = data?.message || data?.error || (typeof data === 'string' ? data : `Enable Banking API error (${res.status})`)
    throw new Error(message)
  }

  return data
}

// Lists banks available in a given country (e.g. "GB"). Pass an empty string to list without any country filter.
export async function listAspsps(country: string) {
  const path = country ? `/aspsps?country=${encodeURIComponent(country)}` : '/aspsps'
  return enableBankingFetch(path)
}

// Step 1 of the connection flow — returns a URL to redirect the client's browser to
export async function startAuthorization(params: {
  aspspName: string
  aspspCountry: string
  redirectUrl: string
  state: string
  psuType?: 'personal' | 'business'
}) {
  const validUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days, matching UK Open Banking's typical consent window
  return enableBankingFetch('/auth', {
    method: 'POST',
    body: JSON.stringify({
      access: { valid_until: validUntil.toISOString() },
      aspsp: { name: params.aspspName, country: params.aspspCountry },
      state: params.state,
      redirect_url: params.redirectUrl,
      psu_type: params.psuType || 'business',
    }),
  })
}

// Step 2 — exchanges the "code" from the bank's redirect for a real session + account list
export async function createSession(code: string) {
  return enableBankingFetch('/sessions', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export async function getAccountTransactions(accountId: string, dateFrom?: string) {
  const qs = dateFrom ? `?date_from=${encodeURIComponent(dateFrom)}` : ''
  return enableBankingFetch(`/accounts/${encodeURIComponent(accountId)}/transactions${qs}`)
}
