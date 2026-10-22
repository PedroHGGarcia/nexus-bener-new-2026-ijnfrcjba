import { supabase } from '@/lib/supabase/client'

export async function generateAISuggestion(data: {
  nome: string
  tipo: string
  valor: number
  moeda: string
}): Promise<{ especificacoes: string | null; error: string | null }> {
  try {
    const { data: result, error } = await supabase.functions.invoke('ai-suggestions', {
      body: data,
    })
    if (error) return { especificacoes: null, error: error.message }
    return { especificacoes: result?.especificacoes ?? null, error: null }
  } catch {
    return { especificacoes: null, error: 'Falha ao conectar com o serviço de IA.' }
  }
}
