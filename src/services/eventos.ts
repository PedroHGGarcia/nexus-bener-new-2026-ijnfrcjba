import { supabase } from '@/lib/supabase/client'

export interface Evento {
  id: string
  titulo: string
  descricao: string | null
  data_inicio: string | null
  data_fim: string | null
  local: string | null
  status: string | null
}

export type EventoInsert = Omit<Evento, 'id'>

export async function fetchEventos(): Promise<Evento[]> {
  const { data, error } = await supabase
    .from('eventos')
    .select('*')
    .order('data_inicio', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Evento[]
}

export async function insertEvento(payload: EventoInsert): Promise<Evento> {
  const { data, error } = await supabase.from('eventos').insert(payload).select().single()
  if (error) throw new Error(error.message)
  return data as Evento
}

export async function updateEvento(id: string, payload: Partial<EventoInsert>): Promise<Evento> {
  const { data, error } = await supabase
    .from('eventos')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Evento
}

export async function deleteEvento(id: string): Promise<void> {
  const { error } = await supabase.from('eventos').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
