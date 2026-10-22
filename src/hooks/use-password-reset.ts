import { useState, useCallback } from 'react'
import {
  requestPasswordReset,
  updatePassword as updatePasswordSvc,
} from '@/services/password-reset'

export function usePasswordReset() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const requestReset = useCallback(async (email: string) => {
    setLoading(true)
    setError(null)
    setSuccess(false)
    const result = await requestPasswordReset(email)
    if (result.ok) {
      setSuccess(true)
    } else if ('error' in result) {
      setError(result.error)
    }
    setLoading(false)
    return result
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    setLoading(true)
    setError(null)
    setSuccess(false)
    const result = await updatePasswordSvc(newPassword)
    if (result.ok) {
      setSuccess(true)
    } else if ('error' in result) {
      setError(result.error)
    }
    setLoading(false)
    return result
  }, [])

  return { loading, error, success, requestReset, updatePassword }
}
