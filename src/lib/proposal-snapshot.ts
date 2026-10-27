import { supabase } from '@/lib/supabase/client'
import type { PropostaVersaoWithRelations } from '@/types/proposta-versao'
import type { VersaoWithModelo } from '@/types/versao'
import type { TipoProposta } from '@/types/tipo-proposta'

export interface VersaoSnapshotData {
  id: string
  nome: string
  cod_erp: string | null
  nome_abreviado: string | null
  imagem_preview: string | null
  moeda: string | null
  valor: number | null
  especificacoes_tecnicas: string | null
  caracteristicas_construtivas: string | null
  acessorios_standards: string | null
  tem_estoque?: boolean
  estoque_disponivel?: number
  modelos?: {
    id: string
    nome: string
    marcas?: { id: string; nome: string } | null
    produtos?: {
      id: string
      nome: string
      categorias_produtos?: { id: string; nome: string } | null
    } | null
  } | null
}

export interface PropostaItemSnapshot {
  id?: string
  versao_id: string
  quantidade: number
  valor_unitario: number
  desconto_percentual?: number
  desconto_valor?: number
  ordem?: number
  tipo_proposta?: string | null
  tipo_proposta_detalhes?: TipoProposta | Record<string, unknown> | null
  versoes: VersaoSnapshotData
  // Acessórios associados explicitamente a esta máquina / item
  acessorios?: Array<{
    id?: string
    nome?: string
    valor?: number
    moeda?: string
    inclusao?: 'preco' | 'opcional'
    quantidade?: number
    desconto_percentual?: number
    desconto_valor?: number
    versao_id?: string
  }>
}

export interface PropostaSnapshotRoot {
  captured_at: string
  captured_by?: string
  is_pacote: boolean
  tipo_proposta?: string | null
  tipo_proposta_detalhes?: TipoProposta | Record<string, unknown> | null
  tipo_proposta_override?: TipoProposta | Record<string, unknown> | null
  primary_versao?: VersaoSnapshotData | null
  itens: PropostaItemSnapshot[]
  acessorios_proposta?: unknown[]
  secoes_adicionais?: Record<string, unknown> | null
  campos_adicionais?: unknown[]
  // Ponto 13: Comissão de Admissão Temporária / Importação Direta
  valor_comissao_servicos?: number | null
  base_comissao_servicos?: number | null
  percentual_comissao_servicos?: number | null
  comissao_servicos_aplicavel?: boolean | null
}

/**
 * Normaliza um objeto de versão para o formato canônico de snapshot.
 */
export function normalizeVersaoToSnapshot(v: any): VersaoSnapshotData {
  if (!v) {
    return {
      id: '',
      nome: 'Equipamento',
      cod_erp: null,
      nome_abreviado: null,
      imagem_preview: null,
      moeda: 'BRL',
      valor: 0,
      especificacoes_tecnicas: null,
      caracteristicas_construtivas: null,
      acessorios_standards: null,
    }
  }

  return {
    id: v.id || '',
    nome: v.nome || v.nome_abreviado || 'Equipamento',
    cod_erp: v.cod_erp ?? null,
    nome_abreviado: v.nome_abreviado ?? null,
    imagem_preview: v.imagem_preview ?? null,
    moeda: v.moeda ?? 'BRL',
    valor: v.valor != null ? Number(v.valor) : 0,
    especificacoes_tecnicas: v.especificacoes_tecnicas ?? null,
    caracteristicas_construtivas: v.caracteristicas_construtivas ?? null,
    acessorios_standards: v.acessorios_standards ?? null,
    tem_estoque: Boolean(v.tem_estoque),
    estoque_disponivel: v.estoque_disponivel != null ? Number(v.estoque_disponivel) : 0,
    modelos: v.modelos
      ? {
          id: v.modelos.id,
          nome: v.modelos.nome,
          marcas: v.modelos.marcas
            ? { id: v.modelos.marcas.id, nome: v.modelos.marcas.nome }
            : null,
          produtos: v.modelos.produtos
            ? {
                id: v.modelos.produtos.id,
                nome: v.modelos.produtos.nome,
                categorias_produtos: v.modelos.produtos.categorias_produtos
                  ? {
                      id: v.modelos.produtos.categorias_produtos.id,
                      nome: v.modelos.produtos.categorias_produtos.nome,
                    }
                  : null,
              }
            : null,
        }
      : null,
  }
}

/**
 * Constrói o snapshot completo a partir dos dados do formulário/emissor de propostas.
 */
export async function buildPropostaSnapshot(params: {
  is_pacote: boolean
  versaoId?: string | null
  tipo_proposta?: string | null
  tipo_proposta_override?: TipoProposta | Record<string, unknown> | null
  userName?: string
  // Itens selecionados no modo pacote ou item único
  itens: Array<{
    versao_id: string
    quantidade: number
    valor_unitario: number
    desconto_percentual?: number
    desconto_valor?: number
    ordem?: number
    tipo_proposta?: string | null
    versoes?: any
  }>
  acessorios_proposta?: any[]
  secoes_adicionais?: Record<string, unknown> | null
  campos_adicionais?: any[]
  // Ponto 13: dados de comissão calculados
  comissao_servicos?: {
    valor_comissao_servicos?: number | null
    base_comissao_servicos?: number | null
    percentual_comissao_servicos?: number | null
    comissao_servicos_aplicavel?: boolean | null
  } | null
  // Cache opcional de versões já carregadas em memória para evitar requests redundantes
  knownVersoes?: VersaoWithModelo[]
}): Promise<{ itens_snapshot: PropostaItemSnapshot[]; dados_snapshot: PropostaSnapshotRoot }> {
  const {
    is_pacote,
    versaoId,
    tipo_proposta,
    tipo_proposta_override = null,
    userName,
    itens,
    acessorios_proposta = [],
    secoes_adicionais = null,
    campos_adicionais = [],
    comissao_servicos = null,
    knownVersoes = [],
  } = params

  // 1. Coleta IDs de versões necessárias que não possuem objeto completo
  const versaoIdsNeeded = new Set<string>()
  if (versaoId) versaoIdsNeeded.add(versaoId)
  itens.forEach((it) => {
    if (it.versao_id) versaoIdsNeeded.add(it.versao_id)
  })

  // Monta mapa de versões
  const versoesMap = new Map<string, any>()
  knownVersoes.forEach((v) => {
    if (v?.id) versoesMap.set(v.id, v)
  })
  itens.forEach((it) => {
    if (it.versoes?.id) versoesMap.set(it.versoes.id, it.versoes)
  })

  const missingIds = Array.from(versaoIdsNeeded).filter((id) => !versoesMap.has(id))
  if (missingIds.length > 0) {
    const { data: fetched } = await supabase
      .from('versoes')
      .select(
        'id, nome, cod_erp, nome_abreviado, imagem_preview, moeda, valor, especificacoes_tecnicas, caracteristicas_construtivas, acessorios_standards, tem_estoque, estoque_disponivel, modelos(id, nome, marcas(id, nome), produtos(id, nome, categorias_produtos:categorias(id, nome)))',
      )
      .in('id', missingIds)
    if (fetched) {
      fetched.forEach((f) => versoesMap.set(f.id, f))
    }
  }

  // 2. Busca detalhes de tipos de proposta referenciados
  const tiposNomes = new Set<string>()
  if (tipo_proposta) tiposNomes.add(tipo_proposta)
  itens.forEach((it) => {
    if (it.tipo_proposta) tiposNomes.add(it.tipo_proposta)
  })
  const tiposMap = new Map<string, any>()
  const tiposArray = Array.from(tiposNomes).filter(Boolean)
  if (tiposArray.length > 0) {
    const { data: fetchedTipos } = await supabase
      .from('tipos_proposta')
      .select('*')
      .in('nome', tiposArray)
    if (fetchedTipos) {
      fetchedTipos.forEach((t) => tiposMap.set(t.nome, t))
    }
  }

  // 3. Constrói a lista de itens congelados (itens_snapshot)
  const itensSnapshot: PropostaItemSnapshot[] = itens.map((it, idx) => {
    const rawV = versoesMap.get(it.versao_id) || it.versoes
    const versaoSnapshot = normalizeVersaoToSnapshot(rawV)
    const effectiveTipo = it.tipo_proposta || (idx === 0 ? tipo_proposta : null)
    // Se há override local para este tipo de proposta, usa com prioridade
    const isOverrideMatch =
      tipo_proposta_override &&
      (!effectiveTipo ||
        effectiveTipo === tipo_proposta ||
        (tipo_proposta_override as any).nome === effectiveTipo)
    const tipoDetalhes = isOverrideMatch
      ? tipo_proposta_override
      : effectiveTipo
        ? tiposMap.get(effectiveTipo) || null
        : null

    const itemAcessorios = Array.isArray(acessorios_proposta)
      ? acessorios_proposta.filter((a) => !a.versao_id || a.versao_id === it.versao_id)
      : []

    return {
      versao_id: it.versao_id,
      quantidade: it.quantidade || 1,
      valor_unitario:
        it.valor_unitario != null ? Number(it.valor_unitario) : versaoSnapshot.valor || 0,
      desconto_percentual: it.desconto_percentual != null ? Number(it.desconto_percentual) : 0,
      desconto_valor: it.desconto_valor != null ? Number(it.desconto_valor) : 0,
      ordem: it.ordem != null ? it.ordem : idx,
      tipo_proposta: effectiveTipo,
      tipo_proposta_detalhes: tipoDetalhes,
      versoes: versaoSnapshot,
      acessorios: itemAcessorios,
    }
  })

  // Se a lista de itens era vazia mas versaoId estava presente (proposta simples direta)
  if (itensSnapshot.length === 0 && versaoId) {
    const rawV = versoesMap.get(versaoId)
    const versaoSnapshot = normalizeVersaoToSnapshot(rawV)
    const tipoDetalhes =
      tipo_proposta_override || (tipo_proposta ? tiposMap.get(tipo_proposta) || null : null)
    itensSnapshot.push({
      versao_id: versaoId,
      quantidade: 1,
      valor_unitario: versaoSnapshot.valor || 0,
      desconto_percentual: 0,
      desconto_valor: 0,
      ordem: 0,
      tipo_proposta: tipo_proposta || null,
      tipo_proposta_detalhes: tipoDetalhes,
      versoes: versaoSnapshot,
      acessorios: Array.isArray(acessorios_proposta) ? acessorios_proposta : [],
    })
  }

  // 4. Versão principal consolidada
  const primaryId = versaoId || itensSnapshot[0]?.versao_id || null
  const primaryVersaoRaw = primaryId ? versoesMap.get(primaryId) || itensSnapshot[0]?.versoes : null
  const primaryVersao = primaryVersaoRaw ? normalizeVersaoToSnapshot(primaryVersaoRaw) : null

  // 5. Root consolidado
  const rootTipoDetalhes =
    tipo_proposta_override || (tipo_proposta ? tiposMap.get(tipo_proposta) || null : null)
  const dadosSnapshot: PropostaSnapshotRoot = {
    captured_at: new Date().toISOString(),
    captured_by: userName,
    is_pacote,
    tipo_proposta: tipo_proposta || null,
    tipo_proposta_detalhes: rootTipoDetalhes,
    tipo_proposta_override: tipo_proposta_override || null,
    primary_versao: primaryVersao,
    itens: itensSnapshot,
    acessorios_proposta,
    secoes_adicionais,
    campos_adicionais,
    valor_comissao_servicos: comissao_servicos?.valor_comissao_servicos ?? null,
    base_comissao_servicos: comissao_servicos?.base_comissao_servicos ?? null,
    percentual_comissao_servicos: comissao_servicos?.percentual_comissao_servicos ?? null,
    comissao_servicos_aplicavel: comissao_servicos?.comissao_servicos_aplicavel ?? null,
  }

  return { itens_snapshot: itensSnapshot, dados_snapshot: dadosSnapshot }
}

/**
 * Converte um snapshot de itens de volta para o formato de PropostaVersaoWithRelations,
 * para compatibilidade transparente com ProposalDocument e outros visualizadores.
 */
export function snapshotToPropostaVersoes(
  itensSnapshot: PropostaItemSnapshot[] | null | undefined,
): PropostaVersaoWithRelations[] {
  if (!Array.isArray(itensSnapshot) || itensSnapshot.length === 0) return []

  return itensSnapshot.map((item, idx) => ({
    id: item.id || `snapshot-${idx}`,
    proposta_id: '',
    versao_id: item.versao_id,
    quantidade: item.quantidade ?? 1,
    valor_unitario: item.valor_unitario ?? 0,
    desconto_percentual: item.desconto_percentual ?? 0,
    desconto_valor: item.desconto_valor ?? 0,
    ordem: item.ordem ?? idx,
    tipo_proposta: item.tipo_proposta ?? null,
    created_at: null,
    updated_at: null,
    versoes: {
      id: item.versoes?.id || item.versao_id,
      nome: item.versoes?.nome || 'Equipamento',
      cod_erp: item.versoes?.cod_erp ?? null,
      nome_abreviado: item.versoes?.nome_abreviado ?? null,
      imagem_preview: item.versoes?.imagem_preview ?? null,
      moeda: item.versoes?.moeda ?? 'BRL',
      valor: item.versoes?.valor ?? 0,
      especificacoes_tecnicas: item.versoes?.especificacoes_tecnicas ?? null,
      caracteristicas_construtivas: item.versoes?.caracteristicas_construtivas ?? null,
      acessorios_standards: item.versoes?.acessorios_standards ?? null,
      tem_estoque: item.versoes?.tem_estoque ?? false,
      estoque_disponivel: item.versoes?.estoque_disponivel ?? 0,
      modelos: item.versoes?.modelos
        ? {
            id: item.versoes.modelos.id,
            nome: item.versoes.modelos.nome,
            marcas: item.versoes.modelos.marcas ?? null,
            produtos: item.versoes.modelos.produtos
              ? {
                  id: item.versoes.modelos.produtos.id,
                  nome: item.versoes.modelos.produtos.nome,
                  categorias_produtos: item.versoes.modelos.produtos.categorias_produtos ?? null,
                }
              : null,
          }
        : null,
    },
  }))
}
