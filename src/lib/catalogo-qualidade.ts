import type { VersaoWithModelo } from '@/types/versao'

export type PendenciaTipo =
  | 'foto_ausente'
  | 'especificacao_vazia'
  | 'caracteristicas_vazias'
  | 'preco_ausente'
  | 'tipos_proposta_vazios'
  | 'sem_modelo'

export const PENDENCIA_TIPOS: PendenciaTipo[] = [
  'foto_ausente',
  'especificacao_vazia',
  'caracteristicas_vazias',
  'preco_ausente',
  'tipos_proposta_vazios',
  'sem_modelo',
]

export const PENDENCIA_LABELS: Record<PendenciaTipo, string> = {
  foto_ausente: 'Foto ausente',
  especificacao_vazia: 'Especificação vazia',
  caracteristicas_vazias: 'Características vazias',
  preco_ausente: 'Preço ausente',
  tipos_proposta_vazios: 'Sem tipo de proposta',
  sem_modelo: 'Sem modelo',
}

const vazio = (s: string | null | undefined) => !s || s.trim() === ''

/** Pendências detectáveis a partir dos campos reais da tabela versoes. */
export function detectarPendencias(v: VersaoWithModelo): PendenciaTipo[] {
  const p: PendenciaTipo[] = []
  if (vazio(v.imagem_preview)) p.push('foto_ausente')
  if (vazio(v.especificacoes_tecnicas)) p.push('especificacao_vazia')
  if (vazio(v.caracteristicas_construtivas)) p.push('caracteristicas_vazias')
  if (!v.valor || v.valor <= 0) p.push('preco_ausente')
  if (!v.tipos_proposta || v.tipos_proposta.length === 0) p.push('tipos_proposta_vazios')
  if (!v.modelos) p.push('sem_modelo')
  return p
}

/** Liberada para proposta e chatbot: status ativo (mesmo critério de fetchVersoes activeOnly). */
export function isVersaoLiberada(status: string | null | undefined): boolean {
  return status === 'Ativo' || status === 'A'
}

export interface ResumoAlteracaoPreco {
  anterior: number
  atual: number
  variacaoPct: number | null
  data: string | null
}

/**
 * Resumo da última alteração de preço registrada na versão (valor_anterior -> valor).
 * Não há snapshot de publicação: a alteração é exibida como pendente de revisão.
 */
export function resumoAlteracaoPreco(v: VersaoWithModelo): ResumoAlteracaoPreco | null {
  if (v.valor_anterior == null || v.valor_anterior === v.valor) return null
  const anterior = Number(v.valor_anterior)
  const atual = Number(v.valor)
  const variacaoPct = anterior > 0 ? ((atual - anterior) / anterior) * 100 : null
  return { anterior, atual, variacaoPct, data: v.data_ultimo_reajuste }
}
