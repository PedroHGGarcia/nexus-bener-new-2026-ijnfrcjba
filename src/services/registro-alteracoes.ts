import { supabase as rawSupabase } from '@/lib/supabase/client'
const supabase = rawSupabase as any

export type EntidadeCatalogo = 'versoes' | 'modelos' | 'produtos' | 'categorias_produtos'

export type AcaoAlteracao = 'criado' | 'editado' | 'excluido' | 'revertido'

export interface CampoAlterado {
  campo: string
  de: unknown
  para: unknown
}

export interface RegistroAlteracao {
  id: string
  entidade: EntidadeCatalogo
  registro_id: string
  registro_nome: string | null
  acao: AcaoAlteracao
  usuario_id: string | null
  usuario_nome: string | null
  usuario_email: string | null
  dados_anteriores: Record<string, unknown> | null
  dados_novos: Record<string, unknown> | null
  campos_alterados: CampoAlterado[] | null
  detalhes: string | null
  revertido_de_id: string | null
  created_at: string
}

export interface FiltrosHistorico {
  entidade?: EntidadeCatalogo | 'todas'
  termoBusca?: string
  acao?: AcaoAlteracao | 'todas'
  registroId?: string
  page?: number
  pageSize?: number
}

export const ENTIDADE_LABELS: Record<EntidadeCatalogo, string> = {
  versoes: 'Versão',
  modelos: 'Modelo',
  produtos: 'Produto',
  categorias_produtos: 'Categoria',
}

export const ACAO_LABELS: Record<AcaoAlteracao, string> = {
  criado: 'Criação',
  editado: 'Edição',
  excluido: 'Exclusão',
  revertido: 'Reversão',
}

export const CAMPOS_AMIGAVEIS: Record<string, string> = {
  nome: 'Nome',
  nome_abreviado: 'Nome Abreviado',
  cod_erp: 'Cód. ERP',
  reg: 'REG',
  cod: 'Código',
  valor: 'Preço',
  valor_anterior: 'Preço Anterior',
  moeda: 'Moeda',
  status: 'Status',
  imagem_preview: 'Imagem de Pré-visualização',
  modelo: 'Modelo Vinculado',
  produto: 'Produto Vinculado',
  categoria: 'Categoria Vinculada',
  categoria_nome: 'Categoria',
  marca: 'Marca Vinculada',
  fabricante: 'Fabricante',
  descricao: 'Descrição',
  especificacoes_tecnicas: 'Especificações Técnicas',
  acessorios_standards: 'Acessórios Standards',
  caracteristicas_construtivas: 'Características Construtivas',
  tipos_proposta: 'Tipos de Proposta',
  fator_nac: 'Fator NAC',
  tem_fator: 'Tem Fator',
  tem_estoque: 'Tem Estoque',
  estoque_total: 'Estoque Total',
  desconto_max_representante: 'Desconto Máx. Representante (%)',
  desconto_max_bener: 'Desconto Máx. Bener (%)',
  alerta_estoque_minimo: 'Alerta Estoque Mínimo',
  logo: 'Logo da Categoria',
  deleted_at: 'Data de Exclusão / Quarentena',
  deleted_by: 'Excluído Por',
  data_ultimo_reajuste: 'Último Reajuste',
  atualizado_por: 'Atualizado Por',
}

/**
 * Resolve o nome real da tabela no banco PostgreSQL a partir do tipo da entidade.
 */
export function getDbTable(entidade: EntidadeCatalogo): string {
  if (entidade === 'categorias_produtos') return 'categorias'
  return entidade
}

/**
 * Consulta registros de histórico com paginação e filtros.
 */
export async function fetchHistoricoAlteracoes(
  filtros: FiltrosHistorico = {},
): Promise<{ data: RegistroAlteracao[]; total: number; error: string | null }> {
  try {
    const page = filtros.page || 1
    const pageSize = filtros.pageSize || 25
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = (supabase as any)
      .from('registro_alteracoes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (filtros.entidade && filtros.entidade !== 'todas') {
      query = query.eq('entidade', filtros.entidade)
    }

    if (filtros.acao && filtros.acao !== 'todas') {
      query = query.eq('acao', filtros.acao)
    }

    if (filtros.registroId) {
      query = query.eq('registro_id', filtros.registroId)
    }

    if (filtros.termoBusca && filtros.termoBusca.trim()) {
      const t = filtros.termoBusca.trim()
      // Busca em registro_nome, usuario_nome, usuario_email ou registro_id
      query = query.or(
        `registro_nome.ilike.%${t}%,usuario_nome.ilike.%${t}%,usuario_email.ilike.%${t}%,registro_id.ilike.%${t}%`,
      )
    }

    const { data, count, error } = await query.range(from, to)

    if (error) {
      console.error('Erro ao buscar histórico de alterações:', error)
      return { data: [], total: 0, error: error.message }
    }

    return {
      data: (data || []) as unknown as RegistroAlteracao[],
      total: count || 0,
      error: null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar histórico'
    return { data: [], total: 0, error: message }
  }
}

/**
 * Reverte uma alteração registrada no histórico:
 * - Se ação for 'editado': restaura os dados anteriores no registro existente.
 * - Se ação for 'excluido': restaura o registro (se foi quarentena, volta status='Ativo'; se foi delete real, reinserte).
 * - Se ação for 'criado': desativa/move para quarentena ou exclui o registro criado, verificando integridade.
 * - Se for edição de preço: restaura o valor e valor_anterior anteriores.
 */
export async function reverterAlteracao(
  alteracao: RegistroAlteracao,
  actor: { nome?: string; email?: string } = {},
): Promise<{ success: boolean; message: string }> {
  try {
    const dbTable = getDbTable(alteracao.entidade)
    const entidadeNomeAmigavel = ENTIDADE_LABELS[alteracao.entidade]

    if (alteracao.acao === 'editado') {
      if (!alteracao.dados_anteriores) {
        return {
          success: false,
          message: 'Não há dados anteriores gravados para realizar esta reversão.',
        }
      }

      // Preparar payload de restauração dos campos alterados
      // Remove campos calculados e id/created_at
      const snapshot = { ...alteracao.dados_anteriores }
      delete (snapshot as Record<string, unknown>).id
      delete (snapshot as Record<string, unknown>).created_at
      ;(snapshot as Record<string, unknown>).updated_at = new Date().toISOString()
      if (alteracao.entidade === 'versoes') {
        ;(snapshot as Record<string, unknown>).atualizado_por = actor.nome || 'Sistema (Reversão)'
      }

      // Verificar se o registro ainda existe
      const { data: existing, error: checkErr } = await (supabase.from(dbTable) as any)
        .select('id, nome')
        .eq('id', alteracao.registro_id)
        .maybeSingle()

      if (checkErr || !existing) {
        return {
          success: false,
          message: `Não foi possível encontrar ${entidadeNomeAmigavel} (ID ${alteracao.registro_id.slice(0, 8)}). O item pode ter sido excluído.`,
        }
      }

      const { error: updateErr } = await (supabase.from(dbTable) as any)
        .update(snapshot)
        .eq('id', alteracao.registro_id)

      if (updateErr) {
        throw new Error(updateErr.message)
      }

      return {
        success: true,
        message: `${entidadeNomeAmigavel} "${alteracao.registro_nome || existing.nome}" foi restaurado(a) com sucesso para os valores anteriores.`,
      }
    }

    if (alteracao.acao === 'excluido') {
      // Caso 1: Item foi colocado em Quarentena (soft-delete) e ainda existe no banco
      const { data: softItem } = await (supabase.from(dbTable) as any)
        .select('id, status, nome')
        .eq('id', alteracao.registro_id)
        .maybeSingle()

      if (softItem) {
        const { error: restoreErr } = await (supabase.from(dbTable) as any)
          .update({
            status: 'Ativo',
            deleted_at: null,
            deleted_by: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', alteracao.registro_id)

        if (restoreErr) throw new Error(restoreErr.message)

        return {
          success: true,
          message: `${entidadeNomeAmigavel} "${alteracao.registro_nome || softItem.nome}" foi reativado(a) com sucesso!`,
        }
      }

      // Caso 2: Item foi deletado fisicamente (DELETE). Recriar com snapshot
      if (!alteracao.dados_anteriores) {
        return {
          success: false,
          message: 'Não há dados completos do registro para recriá-lo.',
        }
      }

      const insertData = { ...alteracao.dados_anteriores }
      // Tentar manter o mesmo ID para não quebrar referências históricas
      delete (insertData as Record<string, unknown>).created_at
      delete (insertData as Record<string, unknown>).updated_at
      delete (insertData as Record<string, unknown>).deleted_at
      delete (insertData as Record<string, unknown>).deleted_by
      ;(insertData as Record<string, unknown>).status = 'Ativo'

      const { error: insertErr } = await (supabase.from(dbTable) as any).insert(insertData)

      if (insertErr) {
        // Se falhar mantendo ID, tenta sem ID
        delete (insertData as Record<string, unknown>).id
        const { error: fallbackErr } = await (supabase.from(dbTable) as any).insert(insertData)
        if (fallbackErr) {
          throw new Error(`Erro ao recriar registro: ${fallbackErr.message || insertErr.message}`)
        }
      }

      return {
        success: true,
        message: `${entidadeNomeAmigavel} "${alteracao.registro_nome || 'registro'}" foi recriado(a) com sucesso com seus dados originais.`,
      }
    }

    if (alteracao.acao === 'criado') {
      // Reverter uma criação significa remover/inativar o registro criado
      // Verificar dependências antes
      const { data: item } = await (supabase.from(dbTable) as any)
        .select('id, nome')
        .eq('id', alteracao.registro_id)
        .maybeSingle()

      if (!item) {
        return {
          success: false,
          message: `${entidadeNomeAmigavel} já não existe mais no banco de dados.`,
        }
      }

      // Se for categoria, verificar se tem produtos vinculados
      if (alteracao.entidade === 'categorias_produtos') {
        const { data: deps } = await supabase
          .from('produtos')
          .select('id, nome')
          .eq('categoria', alteracao.registro_id)
          .limit(1)

        if (deps && deps.length > 0) {
          return {
            success: false,
            message: `Não é possível desfazer a criação da categoria porque existem produtos vinculados a ela ("${deps[0].nome}"). Desvincule os produtos primeiro.`,
          }
        }
      }

      // Se for produto, verificar se tem modelos vinculados
      if (alteracao.entidade === 'produtos') {
        const { data: deps } = await supabase
          .from('modelos')
          .select('id, nome')
          .eq('produto', alteracao.registro_id)
          .limit(1)

        if (deps && deps.length > 0) {
          return {
            success: false,
            message: `Não é possível desfazer a criação do produto porque existem modelos vinculados a ele ("${deps[0].nome}"). Desvincule os modelos primeiro.`,
          }
        }
      }

      // Se for modelo, verificar se tem versões vinculadas
      if (alteracao.entidade === 'modelos') {
        const { data: deps } = await supabase
          .from('versoes')
          .select('id, nome')
          .eq('modelo', alteracao.registro_id)
          .limit(1)

        if (deps && deps.length > 0) {
          return {
            success: false,
            message: `Não é possível desfazer a criação do modelo porque existem versões vinculadas a ele ("${deps[0].nome}"). Desvincule as versões primeiro.`,
          }
        }
      }

      // Se for versão, verificar se está em propostas
      if (alteracao.entidade === 'versoes') {
        const { data: propostasDeps } = await supabase
          .from('propostas')
          .select('id, numero_proposta')
          .eq('versao', alteracao.registro_id)
          .limit(1)

        if (propostasDeps && propostasDeps.length > 0) {
          // Nesse caso, em vez de delete real, colocamos em quarentena para segurança
          await (supabase.from('versoes') as any)
            .update({
              status: 'Em Quarentena',
              deleted_at: new Date().toISOString(),
            })
            .eq('id', alteracao.registro_id)

          return {
            success: true,
            message: `Versão vinculada à proposta ${propostasDeps[0].numero_proposta}. Para preservar a integridade, a versão foi movida para Quarentena em vez de excluída.`,
          }
        }
      }

      // Tentar exclusão
      const { error: delErr } = await (supabase as any)
        .from(dbTable)
        .delete()
        .eq('id', alteracao.registro_id)

      if (delErr) {
        // Fallback: colocar em quarentena caso haja constraint FK de alguma tabela
        const { error: softErr } = await (supabase as any)
          .from(dbTable)
          .update({
            status: 'Em Quarentena',
            deleted_at: new Date().toISOString(),
          })
          .eq('id', alteracao.registro_id)

        if (softErr) {
          throw new Error(`Não foi possível remover: ${delErr.message}`)
        }

        return {
          success: true,
          message: `${entidadeNomeAmigavel} possuía vínculos no sistema e foi movido(a) para Quarentena.`,
        }
      }

      return {
        success: true,
        message: `Criação desfeita com sucesso. ${entidadeNomeAmigavel} foi excluído(a).`,
      }
    }

    if (alteracao.acao === 'revertido') {
      return {
        success: false,
        message: 'Esta alteração já é uma ação de reversão.',
      }
    }

    return {
      success: false,
      message: 'Tipo de ação não suportado para reversão.',
    }
  } catch (err) {
    console.error('Erro ao reverter alteração:', err)
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Erro ao processar reversão.',
    }
  }
}
