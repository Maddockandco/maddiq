import crypto from 'crypto'
import type { ClientFraudPreventionData } from '@/lib/hmrcFraudPreventionClient'

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

export function debugCredentialFingerprint(): string {
  return `cid_len=${CLIENT_ID.length}_cid_last4=${CLIENT_ID.slice(-4)}_secret_len=${CLIENT_SECRET.length}_secret_last4=${CLIENT_SECRET.slice(-4)}_redirect=${REDIRECT_URI}_base=${API_BASE}`
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

// --- Fraud prevention headers --------------------------------------------
// Required by law on every VAT (MTD) API call (not the OAuth handshake).
// Spec: https://developer.service.hmrc.gov.uk/guides/fraud-prevention/connection-method/web-app-via-server/
//
// This combines browser-collected data (passed in from the client) with
// server-determined values: the end user's public IP as seen by OUR server,
// and our own server's egress IP (looked up live via ipify, since Vercel's
// serverless functions don't have one fixed static outbound IP to hardcode).

const VENDOR_VERSION = 'maddiq=1.0.0'

export interface ServerRequestContext {
  clientPublicIp: string
  userId: string
}

async function getOwnPublicIp(): Promise<string> {
  try {
    const res = await fetch('https://api.ipify.org?format=json')
    const data = await res.json()
    return data.ip || ''
  } catch {
    return ''
  }
}

export async function buildFraudPreventionHeaders(
  clientData: ClientFraudPreventionData,
  ctx: ServerRequestContext
): Promise<Record<string, string>> {
  const vendorIp = await getOwnPublicIp()

  const headers: Record<string, string> = {
    'Gov-Client-Connection-Method': 'WEB_APP_VIA_SERVER',
    'Gov-Client-Device-ID': clientData.deviceId,
    'Gov-Client-User-IDs': `maddiq=${encodeURIComponent(ctx.userId)}`,
    'Gov-Client-Timezone': clientData.timezone,
    'Gov-Client-Screens': clientData.screens,
    'Gov-Client-Window-Size': clientData.windowSize,
    'Gov-Client-Browser-JS-User-Agent': clientData.userAgent,
    'Gov-Vendor-Version': VENDOR_VERSION,
  }

  // Fields that are genuinely best-effort or sometimes uncollectable are only
  // sent when we actually have a value - HMRC's compliance rules treat
  // incorrect/fabricated data as worse than a documented gap.
  if (clientData.browserPlugins) headers['Gov-Client-Browser-Plugins'] = clientData.browserPlugins
  if (clientData.doNotTrack) headers['Gov-Client-Browser-Do-Not-Track'] = clientData.doNotTrack
  if (clientData.localIPs) headers['Gov-Client-Local-IPs'] = clientData.localIPs
  if (ctx.clientPublicIp) headers['Gov-Client-Public-IP'] = ctx.clientPublicIp
  if (vendorIp) headers['Gov-Vendor-Public-IP'] = vendorIp
  if (vendorIp && ctx.clientPublicIp) {
    headers['Gov-Vendor-Forwarded'] = `by=${vendorIp}&for=${ctx.clientPublicIp}`
  }

  return headers
}

// --- Authenticated API calls ---------------------------------------------

export interface HmrcConnectionRow {
  id: string
  vrn: string
  access_token_encrypted: string
  refresh_token_encrypted: string
  token_expires_at: string
}

export interface RefreshedTokenFields {
  access_token_encrypted: string
  refresh_token_encrypted: string
  token_expires_at: string
}

// Refreshes if the token is expired or within 60s of expiring. Callers pass
// a persist callback so this stays decoupled from any specific Supabase
// client instance (route handlers may use the user's own session or the
// service-role client depending on context).
export async function getValidAccessToken(
  connection: HmrcConnectionRow,
  onRefreshed: (tokens: RefreshedTokenFields) => Promise<void>
): Promise<string> {
  const expiresAt = new Date(connection.token_expires_at).getTime()
  if (expiresAt - Date.now() > 60_000) {
    return decryptToken(connection.access_token_encrypted)
  }

  const refreshToken = decryptToken(connection.refresh_token_encrypted)
  const tokens = await refreshTokens(refreshToken)
  await onRefreshed({
    access_token_encrypted: encryptToken(tokens.access_token),
    refresh_token_encrypted: encryptToken(tokens.refresh_token),
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  })
  return tokens.access_token
}

export async function hmrcApiRequest<T = any>(
  path: string,
  accessToken: string,
  fraudHeaders: Record<string, string>,
  acceptVersion = '1.0'
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: `application/vnd.hmrc.${acceptVersion}+json`,
      ...fraudHeaders,
    },
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const message = data?.message || data?.code || `HMRC API request failed (${res.status})`
    throw new Error(message)
  }
  return data
}
