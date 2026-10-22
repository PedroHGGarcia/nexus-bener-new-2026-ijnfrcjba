import { supabase } from '@/lib/supabase/client'
import type { ServiceResult } from '@/lib/utils'

export interface AiSuggestionInput {
  nome: string
  tipo: string
  valor?: number
  moeda?: string
}

export async function generateAiSuggestion(
  input: AiSuggestionInput,
): Promise<ServiceResult<string>> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-suggestions', {
      body: input,
    })
    if (error) return { ok: false, error: error.message }
    const text = data?.especificacoes ?? 'Não foi possível gerar a sugestão.'
    return { ok: true, data: text }
  } catch {
    return { ok: false, error: 'Falha ao conectar com o serviço de IA.' }
  }
}

export async function generateAccessorySpecs(params: {
  nome: string
  tipo: string
  valor: number
  moeda: string
}): Promise<ServiceResult<string>> {
  return generateAiSuggestion(params)
}

export async function generateProposalDescription(params: {
  equipamento: string
  cliente: string
}): Promise<ServiceResult<string>> {
  return generateAiSuggestion({
    nome: params.equipamento,
    tipo: 'descricao_proposta',
  })
}

export function isAiAvailable(): boolean {
  return !!import.meta.env.VITE_SUPABASE_URL
}
