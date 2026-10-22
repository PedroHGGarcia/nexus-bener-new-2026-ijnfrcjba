import { verifyRecaptchaToken as verifyToken } from '@/services/verify-recaptcha'
import type { ServiceResult } from '@/lib/utils'

export const RECAPTCHA_SITE_KEY: string =
  (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string) || '6Lc-xGktAAAAABkxZBa7Sbd1-dU3QHRJbR6D6C21'

export function isRecaptchaEnabled(): boolean {
  return !!RECAPTCHA_SITE_KEY
}

export async function verifyRecaptchaToken(
  token: string,
  action: string = 'login',
): Promise<ServiceResult<{ verified: boolean }>> {
  return verifyToken(token, action)
}

export function getRecaptchaConfig() {
  return {
    siteKey: RECAPTCHA_SITE_KEY,
    enabled: isRecaptchaEnabled(),
    size: 'normal' as const,
  }
}
