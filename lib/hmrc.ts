import crypto from 'crypto'

const API_BASE = process.env.HMRC_API_BASE_URL!
const CLIENT_ID = process.env.HMRC_CLIENT_ID!
const CLIENT_SECRET = process.env.HMRC_CLIENT_SECRET!
const REDIRECT_URI = process.env.HMRC_REDIRECT_URI!

// HMRC's VAT (MTD) scopes. write:vat is needed to eventually submit returns;
// read:vat covers obligations/liabilities/viewing past submissions.
const SCOPES = 'read:vat write:vat'

// --- Token encryption -------------------------------------------------
// Real OAuth bearer tokens, unlike Enable Banking's session model - these
// grant ongoing API access, so they're encrypted at rest with AES-256-GCM
// rather than stored in plain text. HMRC_TOKEN_ENCRYPTION_KEY must be a
// 32-byte key, base64-encoded (generate with `openssl rand -base64 32`).

function getEncryptionKey(): Buffer {
  const raw = process.env.HMRC_TOKEN_ENCRYPTION_KEY
  if (!raw) throw new Error('HMRC_TOKEN_ENCRYPTION_KEY is not set')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('HMRC_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes')
  return key
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':')
}

export function decryptToken(stored: string): string {
  const key = getEncryptionKey()
  const [ivB64, authTagB64, dataB64] = stored.split(':')
  if (!ivB64 || !authTagB64 || !dataB64) throw new Error('Malformed encrypted token')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()])
  return decrypted.toString('utf8')
}

// --- OAuth flow ---------------------------------------------------------

// state is the hmrc_auth_requests row id - same pattern as bank_auth_requests,
// its existence (and firm scoping via RLS on lookup) is the CSRF protection.
export function buildAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
  })
  return `${API_BASE}/oauth/authorize?${params.toString()}`
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
}

async function hmrcTokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok || !data) {
    const message = data?.error_description || data?.error || `HMRC token request failed (${res.status})`
    throw new Error(message)
  }
  return data
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  return hmrcTokenRequest({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    code,
  })
}

export async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  return hmrcTokenRequest({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
}
