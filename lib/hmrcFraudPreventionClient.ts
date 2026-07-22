// Collects what HMRC's fraud prevention spec requires from the BROWSER side.
// This runs client-side only - none of this is sensitive (it's the same kind
// of data any website's analytics script already reads), but it does need to
// come from the actual browser, not be fabricated server-side.
// Spec: https://developer.service.hmrc.gov.uk/guides/fraud-prevention/connection-method/web-app-via-server/

const DEVICE_ID_KEY = 'maddiq_hmrc_device_id'

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

function getTimezone(): string {
  const offsetMinutes = -new Date().getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMinutes)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `UTC${sign}${hh}:${mm}`
}

function getScreens(): string {
  const s = window.screen
  const scalingFactor = window.devicePixelRatio || 1
  return `width=${s.width}&height=${s.height}&scaling-factor=${scalingFactor}&colour-depth=${s.colorDepth}`
}

function getWindowSize(): string {
  return `width=${window.innerWidth}&height=${window.innerHeight}`
}

function getBrowserPlugins(): string {
  const plugins = Array.from(navigator.plugins || []).map((p) => encodeURIComponent(p.name))
  return plugins.join(',')
}

// Best-effort only. Modern browsers heavily restrict this for privacy
// (Chrome obfuscates real local IPs behind mDNS hostnames like
// "xxxx.local" - HMRC's own spec examples show this exact format is
// acceptable). If this fails or times out, we submit nothing rather than
// fabricate a value - HMRC's compliance rules are explicit that incorrect
// data is worse than a documented gap.
function collectLocalIPs(): Promise<string> {
  return new Promise((resolve) => {
    try {
      const ips = new Set<string>()
      const pc = new RTCPeerConnection({ iceServers: [] })
      pc.createDataChannel('')
      pc.createOffer().then((offer) => pc.setLocalDescription(offer))
      pc.onicecandidate = (event) => {
        if (!event.candidate) return
        const match = event.candidate.candidate.match(/([0-9a-f.:]+)(?=\s\d+\s(typ|generation))/i)
        if (match) ips.add(match[1])
      }
      setTimeout(() => {
        pc.close()
        resolve(Array.from(ips).join(','))
      }, 800)
    } catch {
      resolve('')
    }
  })
}

export interface ClientFraudPreventionData {
  deviceId: string
  timezone: string
  screens: string
  windowSize: string
  browserPlugins: string
  userAgent: string
  doNotTrack: string
  localIPs: string
}

export async function collectClientFraudPreventionData(): Promise<ClientFraudPreventionData> {
  return {
    deviceId: getOrCreateDeviceId(),
    timezone: getTimezone(),
    screens: getScreens(),
    windowSize: getWindowSize(),
    browserPlugins: getBrowserPlugins(),
    userAgent: navigator.userAgent,
    doNotTrack: navigator.doNotTrack === '1' ? 'true' : 'false',
    localIPs: await collectLocalIPs(),
  }
}
