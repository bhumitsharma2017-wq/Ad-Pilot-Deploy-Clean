import type { BusinessGoal, Platform } from '@/types'

export const SUPPORTED_PLATFORMS: Platform[] = [
  'google',
  'meta',
  'linkedin',
  'youtube',
  'shopping',
  'demand_gen',
  'performance_max',
]

export const BUSINESS_GOALS: BusinessGoal[] = [
  'lead_generation',
  'ecommerce_sales',
  'app_installs',
  'brand_awareness',
  'website_traffic',
]

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [first, second] = parts
  return first === 10
    || first === 127
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 169 && second === 254)
    || first === 0
}

/** Normalizes public website URLs before the server crawls them. */
export function normalizePublicWebsiteUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const candidate = value.trim().startsWith('http') ? value.trim() : `https://${value.trim()}`

  try {
    const url = new URL(candidate)
    const host = url.hostname.toLowerCase()
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host === '::1' || isPrivateIpv4(host)) return null
    if (host.includes(':') && (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:'))) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

export function isBusinessGoal(value: unknown): value is BusinessGoal {
  return typeof value === 'string' && BUSINESS_GOALS.includes(value as BusinessGoal)
}

export function normalizePlatforms(value: unknown): Platform[] | null {
  if (!Array.isArray(value)) return null
  const platforms = value.filter((platform): platform is Platform =>
    typeof platform === 'string' && SUPPORTED_PLATFORMS.includes(platform as Platform)
  )
  const unique = [...new Set(platforms)]
  return unique.length ? unique : null
}

export function normalizeMonthlyBudget(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount) || amount < 100 || amount > 10_000_000) return null
  return Math.round(amount * 100) / 100
}

export function normalizeCountry(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const country = value.trim().replace(/\s+/g, ' ')
  return country.length >= 2 && country.length <= 80 ? country : null
}
