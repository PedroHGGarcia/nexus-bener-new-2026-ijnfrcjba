import { supabase } from '@/lib/supabase/client'

const JWT_FUTURE_PATTERNS = ['jwt issued at future', 'jwt expired', 'invalid jwt']

export function isJwtError(error: unknown): boolean {
  if (!error) return false
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : 'object' in (error as any) && (error as any)?.message
          ? String((error as any).message)
          : String(error)
  const lower = message.toLowerCase()
  return JWT_FUTURE_PATTERNS.some((p) => lower.includes(p))
}

export async function refreshSession(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.refreshSession()
    return !error
  } catch {
    return false
  }
}

export async function withJwtRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (!isJwtError(error)) throw error
    const refreshed = await refreshSession()
    if (!refreshed) throw error
    return await fn()
  }
}
