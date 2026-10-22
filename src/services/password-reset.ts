import { supabase } from '@/lib/supabase/client'
import type { ServiceResult } from '@/lib/utils'

export interface VerifyTokenResult {
  valid: boolean
  email?: string
  userId?: string
  error?: string
}

export interface ResetPasswordResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Requests password reset by calling the send-password-reset edge function,
 * which generates a friendly 15-min token URL (/redefinir-senha?token=...)
 * and triggers the n8n webhook.
 */
export async function requestPasswordReset(
  email: string,
): Promise<ServiceResult<{ sent: boolean; message?: string }>> {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const { data, error } = await supabase.functions.invoke('send-password-reset', {
      body: {
        action: 'request',
        email: email.trim().toLowerCase(),
        appBaseUrl: origin,
      },
    })

    if (error) {
      // Fallback: try direct Supabase auth if edge function fails
      console.warn('send-password-reset invocation error:', error)
      const { error: fallbackError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/redefinir-senha`,
      })
      if (fallbackError) {
        return { ok: false, error: fallbackError.message }
      }
      return {
        ok: true,
        data: {
          sent: true,
          message: 'Se o e-mail estiver cadastrado, você receberá o link de recuperação.',
        },
      }
    }

    if (data && data.success === false) {
      return { ok: false, error: data.error || 'Falha ao solicitar recuperação de senha.' }
    }

    return {
      ok: true,
      data: {
        sent: true,
        message:
          data?.message || 'Se o e-mail estiver cadastrado, você receberá o link de recuperação.',
      },
    }
  } catch (err) {
    console.error('requestPasswordReset exception:', err)
    return { ok: false, error: 'Erro ao enviar e-mail de recuperação de senha.' }
  }
}

/**
 * Verifies if a reset token is valid and not expired (15 minutes).
 */
export async function verifyResetToken(token: string): Promise<VerifyTokenResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-password-reset', {
      body: {
        action: 'verify',
        token: token.trim(),
      },
    })

    if (error) {
      return {
        valid: false,
        error: error.message || 'Erro ao validar token de recuperação.',
      }
    }

    if (!data || data.valid === false) {
      return {
        valid: false,
        error: data?.error || 'Link de recuperação inválido ou expirado (limite de 15 minutos).',
      }
    }

    return {
      valid: true,
      email: data.email,
      userId: data.userId,
    }
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Erro ao verificar link de recuperação.',
    }
  }
}

/**
 * Resets password using the verified friendly token.
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<ServiceResult<{ updated: boolean; message?: string }>> {
  try {
    const { data, error } = await supabase.functions.invoke('send-password-reset', {
      body: {
        action: 'reset',
        token: token.trim(),
        newPassword,
      },
    })

    if (error) {
      return { ok: false, error: error.message || 'Erro ao redefinir a senha.' }
    }

    if (data && data.success === false) {
      return { ok: false, error: data.error || 'Não foi possível redefinir a senha.' }
    }

    return { ok: true, data: { updated: true, message: data?.message } }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro inesperado ao redefinir a senha.',
    }
  }
}

/**
 * Standard session-based password update (for logged-in users).
 */
export async function updatePassword(
  newPassword: string,
): Promise<ServiceResult<{ updated: boolean }>> {
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: { updated: true } }
  } catch {
    return { ok: false, error: 'Erro ao atualizar a senha.' }
  }
}
