import { Json } from '@/lib/supabase/types'

export interface TipoProposta {
  id: string
  nome: string
  status: string
  aplicar_fator_nac: boolean | null
  comissao: number | null
  frase_preco: string | null
  frase_comissao: string | null
  prazo_entrega: string | null
  condicoes_pagamento: string | null
  garantia: string | null
  assistencia_tecnica: string | null
  treinamento_tecnico: string | null
  transporte_seguro: string | null
  validade_oferta: string | null
  imposto_ipi: string | null
  imposto_icms: string | null
  campos_adicionais?: Json | Array<{ titulo: string; conteudo: string }> | null
  atualizado_por?: string | null
  created_at: string | null
  updated_at: string | null
}

export type TipoPropostaInsert = Omit<TipoProposta, 'id' | 'created_at' | 'updated_at'>
export type TipoPropostaUpdate = Partial<TipoPropostaInsert> & { id: string }
