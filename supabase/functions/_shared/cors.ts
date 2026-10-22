// Restrict CORS origins to allowed production, preview and local development domains
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/nexus\.bener\.com\.br$/,
  /^https:\/\/.*\.goskip\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
]

export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get('origin') || ''
  const isAllowed = ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))
  const allowedOrigin = isAllowed ? origin : 'https://nexus.bener.com.br'

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, x-supabase-client-platform, apikey, content-type, x-internal-service-secret, x-callback-token',
    Vary: 'Origin',
  }
}

// Fallback constant for backwards compatibility
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://nexus.bener.com.br',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-supabase-client-platform, apikey, content-type, x-internal-service-secret, x-callback-token',
  Vary: 'Origin',
}
