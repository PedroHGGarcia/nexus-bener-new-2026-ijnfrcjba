import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { UserProfile } from '@/types'
import { fetchProfile, updateProfileDb } from '@/services/profiles'

interface AuthContextType {
  user: UserProfile | null
  session: Session | null
  loading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ error: string | null }>
  updateProfile: (data: Partial<UserProfile>) => Promise<{ error: string | null }>
  refreshProfile: () => Promise<UserProfile | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) return
    setLoading(true)
    fetchProfile(session.user.id).then((profile) => {
      setUser(profile)
      setLoading(false)
    })
  }, [session?.user?.id])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }, [])

  const resetPassword = useCallback(async (email: string) => {
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
        const { error: fallbackError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/redefinir-senha`,
        })
        return { error: fallbackError?.message ?? null }
      }
      if (data && data.success === false) {
        return { error: data.error || 'Falha ao solicitar recuperação de senha' }
      }
      return { error: null }
    } catch {
      return { error: 'Erro ao solicitar recuperação de senha' }
    }
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error?.message ?? null }
  }, [])

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!user?.email) return { error: 'Usuário não autenticado' }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (signInError) {
        return { error: 'Senha atual incorreta' }
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      return { error: updateError?.message ?? null }
    },
    [user],
  )

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return null
    const profile = await fetchProfile(session.user.id)
    setUser(profile)
    return profile
  }, [session?.user?.id])

  const updateProfile = useCallback(
    async (data: Partial<UserProfile>) => {
      if (!user) return { error: 'Not authenticated' }
      const { error } = await updateProfileDb(user.id, data)
      if (!error) {
        setUser({ ...user, ...data })
      }
      return { error }
    },
    [user],
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        changePassword,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
