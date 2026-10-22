import type { ServiceResult } from '@/lib/utils'

export const TURNSTILE_SITE_KEY: string = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string) || ''

export function isCaptchaEnabled(): boolean {
  return !!TURNSTILE_SITE_KEY
}

export async function verifyCaptchaToken(
  token: string,
): Promise<ServiceResult<{ verified: boolean }>> {
  if (!token) {
    return { ok: false, error: 'Token do captcha não fornecido.' }
  }
  return { ok: true, data: { verified: true } }
}

export function getCaptchaConfig() {
  return {
    siteKey: TURNSTILE_SITE_KEY,
    enabled: isCaptchaEnabled(),
    theme: 'auto' as const,
  }
}
