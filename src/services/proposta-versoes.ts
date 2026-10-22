import { supabase } from '@/lib/supabase/client'
import { PropostaVersaoInsert, PropostaVersaoWithRelations } from '@/types/proposta-versao'

const TABLE = 'proposta_versoes'

const SELECT_RELATIONS =
  '*, versoes(id, nome, cod_erp, nome_abreviado, imagem_preview, moeda, valor, especificacoes_tecnicas, caracteristicas_construtivas, acessorios_standards, tem_estoque, estoque_disponivel, modelos(id, nome, marcas(id, nome), produtos(id, nome, categorias_produtos:categorias(id, nome))))'

export async function fetchPropostaVersoes(
  propostaId: string,
): Promise<PropostaVersaoWithRelations[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_RELATIONS)
    .eq('proposta_id', propostaId)
    .order('ordem', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PropostaVersaoWithRelations[]
}

export async function replacePropostaVersoes(
  propostaId: string,
  items: PropostaVersaoInsert[],
): Promise<void> {
  const { error: delError } = await supabase.from(TABLE).delete().eq('proposta_id', propostaId)
  if (delError) throw new Error(delError.message)

  if (items.length === 0) return

  const payload = items.map((item, idx) => ({
    proposta_id: propostaId,
    versao_id: item.versao_id,
    quantidade: item.quantidade,
    valor_unitario: item.valor_unitario,
    desconto_percentual: item.desconto_percentual ?? 0,
    desconto_valor: item.desconto_valor ?? 0,
    ordem: item.ordem ?? idx,
    tipo_proposta: item.tipo_proposta ?? null,
  }))

  const { error: insError } = await supabase.from(TABLE).insert(payload)
  if (insError) throw new Error(insError.message)
}
