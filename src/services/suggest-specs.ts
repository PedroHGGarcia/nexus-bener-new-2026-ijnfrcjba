import { supabase } from '@/lib/supabase/client'
import type { ServiceResult } from '@/lib/utils'

interface SuggestSpecsParams {
  type: 'versao' | 'acessorio'
  nome: string
  versoes?: Array<string | { nome: string }>
}

export async function suggestSpecs(
  params: SuggestSpecsParams,
): Promise<ServiceResult<{ especificacoes: string }>> {
  const { data, error } = await supabase.functions.invoke('suggest-specs', {
    body: params,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  if (data?.error) {
    return { ok: false, error: data.error }
  }

  return { ok: true, data: { especificacoes: data?.data?.especificacoes ?? '' } }
}
