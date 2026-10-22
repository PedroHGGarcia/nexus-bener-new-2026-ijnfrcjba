import { supabase } from '@/lib/supabase/client'

export interface ClienteAntigoItem {
  nome?: string
  cnpj?: string
  email?: string
  telefone?: string
  contato?: string
  endereco?: string
  cidade?: string
  uf?: string
  cep?: string
}

export interface ImportacaoClientesAntigosResult {
  inseridos: number
  atualizados: number
  total: number
  ignorados?: number
}

export async function importarClientesAntigosBatch(
  clientes: ClienteAntigoItem[],
): Promise<ImportacaoClientesAntigosResult> {
  const { data, error } = await supabase.functions.invoke('importar-base-antiga', {
    method: 'POST',
    body: { clientes },
  })

  if (error) {
    throw new Error(error.message || 'Erro ao invocar função de importação.')
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return {
    inseridos: data?.inseridos ?? 0,
    atualizados: data?.atualizados ?? 0,
    total: data?.total ?? 0,
    ignorados: data?.ignorados ?? 0,
  }
}
