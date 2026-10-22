import { supabase } from '@/lib/supabase/client'

export interface Preferencia {
  id: string
  usuario: string | null
  chave: string
  valor: unknown
}

export async function fetchPreferencias(userId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from('preferencias').select('*').eq('usuario', userId)
  if (error) throw new Error(error.message)
  const result: Record<string, unknown> = {}
  ;(data ?? []).forEach((p) => {
    result[p.chave] = p.valor
  })
  return result
}

export async function savePreferencia(
  userId: string,
  chave: string,
  valor: unknown,
): Promise<void> {
  const { error } = await supabase
    .from('preferencias')
    .upsert(
      { usuario: userId, chave, valor: valor as import('@/lib/supabase/types').Json },
      { onConflict: 'usuario,chave' },
    )
  if (error) throw new Error(error.message)
}
