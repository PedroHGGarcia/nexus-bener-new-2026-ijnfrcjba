import { supabase } from '@/lib/supabase/client'

export interface ImportHistoryEntry {
  id: string
  tipo: string | null
  arquivo: string | null
  status: string | null
  registros_importados: number | null
  registros_erro: number | null
  erros: unknown
  usuario: string | null
  created_at: string
}

export async function fetchImportHistory(): Promise<ImportHistoryEntry[]> {
  const { data, error } = await supabase
    .from('historico_importacoes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ImportHistoryEntry[]
}
