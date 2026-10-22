import { supabase } from '@/lib/supabase/client'
import type { ServiceResult } from '@/lib/utils'

export async function verifyRecaptchaToken(
  token: string,
  action: string = 'login',
): Promise<ServiceResult<{ verified: boolean }>> {
  if (!token) {
    return { ok: false, error: 'Token do captcha não fornecido.' }
  }

  const { data, error } = await supabase.functions.invoke('verify-recaptcha', {
    body: { token, action: action || 'login' },
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  if (data?.error) {
    return { ok: false, error: data.error }
  }

  return { ok: true, data: { verified: data?.data?.success ?? false } }
}
