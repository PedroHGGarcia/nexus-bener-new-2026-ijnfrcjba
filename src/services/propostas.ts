import { supabase } from '@/lib/supabase/client'
import { Proposta, PropostaInsert, PropostaWithRelations } from '@/types/proposta'

const TABLE = 'propostas'
const STORAGE_BUCKET = 'propostas-files'

const SELECT_RELATIONS =
  '*, clientes(fantasia, razao_social, documento, contato, email, telefone, cep, estado, cidade, bairro, logradouro, numero, complementos), cliente_contatos:contato_id(id, nome, cargo, email, telefone, is_principal), versoes(id, nome, cod_erp, nome_abreviado, imagem_preview, moeda, valor, especificacoes_tecnicas, caracteristicas_construtivas, acessorios_standards, modelos(id, nome, marcas(id, nome), produtos(id, nome, categorias_produtos:categorias(id, nome)))), representantes:representante(id, fantasia, sigla), gerentes:gerente(id, nome), projetos:projeto(id, nome), assinante_representante:assinante_representante_id(id, fantasia), assinante_gerente:assinante_gerente_id(id, nome)'

export async function fetchPropostas(options?: {
  userId?: string
  userName?: string
  userEmail?: string
  isVendedorOuRep?: boolean
}): Promise<PropostaWithRelations[]> {
  let query = supabase
    .from(TABLE)
    .select(SELECT_RELATIONS)
    .order('created_at', { ascending: false })

  if (options?.isVendedorOuRep && (options.userId || options.userEmail)) {
    // Busca representante vinculado a este perfil para cobrir tanto user quanto representante_id
    let repIds: string[] = []
    try {
      const repQuery = supabase.from('representantes').select('id')

      const filters: string[] = []
      if (options.userId) filters.push(`profile_id.eq.${options.userId}`)
      if (options.userEmail) filters.push(`email.ilike.${options.userEmail}`)

      if (filters.length > 0) {
        const { data: reps } = await repQuery.or(filters.join(','))
        if (reps && reps.length > 0) {
          repIds = reps.map((r) => r.id)
        }
      }
    } catch {
      // continua com filtros de user
    }

    const orClauses: string[] = []
    if (options.userId) {
      orClauses.push(`user.eq.${options.userId}`)
    }
    if (options.userEmail) {
      orClauses.push(`user.ilike.${options.userEmail}`)
    }
    if (options.userName) {
      orClauses.push(`user.ilike.${options.userName}`)
    }
    if (repIds.length > 0) {
      orClauses.push(`representante.in.(${repIds.join(',')})`)
    }

    if (orClauses.length > 0) {
      query = query.or(orClauses.join(','))
    }
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PropostaWithRelations[]
}

export async function fetchPropostaById(id: string): Promise<PropostaWithRelations | null> {
  const { data, error } = await supabase.from(TABLE).select(SELECT_RELATIONS).eq('id', id).single()
  if (error) return null
  return data as unknown as PropostaWithRelations
}

export async function fetchPropostaByNumero(numero: string): Promise<PropostaWithRelations | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_RELATIONS)
    .eq('numero_proposta', numero)
    .maybeSingle()
  if (error) return null
  return (data as unknown as PropostaWithRelations) ?? null
}

function parseVersionedNumero(numero: string | null): { base: string; letter: string } {
  if (!numero) return { base: '', letter: 'A' }
  const match = numero.match(/^(.+)-([A-Z])$/)
  if (match) return { base: match[1], letter: match[2] }
  return { base: numero, letter: 'A' }
}

function nextVersionLetter(letter: string): string {
  return String.fromCharCode(letter.charCodeAt(0) + 1)
}

export async function insertProposta(
  payload: Partial<PropostaInsert>,
  userName?: string,
  userId?: string,
): Promise<Proposta> {
  if (!payload.projeto) {
    throw new Error('A associação a um projeto é obrigatória para emitir a proposta.')
  }

  // Ponto 18 & Ponto 4: Validação no salvamento — Pacote exige tipo de proposta definido na primeira máquina
  // e tipos de proposta do mesmo método de fornecimento em todas as máquinas.
  if (payload.is_pacote) {
    const itens = Array.isArray(payload.itens_snapshot)
      ? (payload.itens_snapshot as Array<{ tipo_proposta?: string; nome?: string }>)
      : []

    if (itens.length > 0) {
      const firstItem = itens[0]
      const firstTipo =
        (typeof firstItem?.tipo_proposta === 'string' && firstItem.tipo_proposta.trim()) ||
        (typeof payload.tipo_proposta === 'string' && payload.tipo_proposta.trim()) ||
        ''

      if (!firstTipo) {
        throw new Error(
          'Selecione o tipo de proposta da primeira máquina para salvar a proposta pacote.',
        )
      }

      const getGroup = (t: string) => {
        const lower = t.toLowerCase()
        if (lower.includes('importacao direta') || lower.includes('importação direta'))
          return 'Importação Direta'
        if (lower.includes('nacionalizada')) return 'Nacionalizada'
        return 'Outro'
      }

      const firstGroup = getGroup(firstTipo)
      for (let i = 1; i < itens.length; i++) {
        const itemTipo =
          typeof itens[i]?.tipo_proposta === 'string' ? itens[i].tipo_proposta!.trim() : ''
        if (!itemTipo) {
          throw new Error(
            `Selecione o tipo de proposta para a máquina "${itens[i].nome || `Item ${i + 1}`}" do pacote.`,
          )
        }
        if (getGroup(itemTipo) !== firstGroup) {
          throw new Error(
            'Pacotes só aceitam máquinas com o mesmo tipo de fornecimento. Verifique os tipos de proposta selecionados para cada equipamento.',
          )
        }
        // Ponto 19 (Filtro Fino): Todas as máquinas seguintes herdam e devem ter exatamente o tipo da primeira máquina
        if (itemTipo !== firstTipo) {
          throw new Error(
            `Esta máquina não possui o tipo de proposta selecionado neste pacote (${firstTipo}). Cadastre o tipo na máquina ou remova-a do pacote.`,
          )
        }
      }
    }
  }
  const isLicitacao = payload.modelo_licitacao === true
  const { data: generatedNumero, error: rpcError } = await supabase.rpc(
    'generate_next_proposta_numero',
    { is_licitacao: isLicitacao },
  )
  if (rpcError) throw new Error(rpcError.message)
  const baseNumero = (generatedNumero as string) || `PROP-${new Date().getFullYear()}-001`
  const today = new Date().toISOString().split('T')[0]
  const insertPayload = {
    ...payload,
    numero_proposta: payload.numero_proposta || `${baseNumero}-A`,
    revisao: payload.revisao || 'A',
    dt_cad: today,
    user: userName ?? 'Sistema',
    data_alteracao_status: new Date().toISOString(),
    ultimo_usuario_status: userName ?? 'Sistema',
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert(
      insertPayload as unknown as import('@/lib/supabase/types').Database['public']['Tables']['propostas']['Insert'],
    )
    .select()
    .single()
  if (error) throw new Error(error.message)

  if (userId && payload.projeto) {
    supabase
      .from('projeto_membros')
      .upsert(
        { projeto_id: payload.projeto, user_id: userId, papel: 'Colaborador' },
        { onConflict: 'projeto_id,user_id' },
      )
      .then(({ error: e }) => {
        if (e && e.code !== '23505') console.warn(e.message)
      })
  }

  return data as unknown as Proposta
}

export async function createPropostaVersion(
  originalId: string,
  payload: Partial<PropostaInsert>,
  userName?: string,
  userId?: string,
): Promise<Proposta> {
  const original = await fetchPropostaById(originalId)
  if (!original) throw new Error('Proposta original não encontrada')

  const { base, letter: parsedLetter } = parseVersionedNumero(original.numero_proposta)
  const baseId = base || original.numero_proposta || ''
  if (!baseId) throw new Error('Proposta original não possui número de identificação')

  const revisaoLetter = original.revisao && original.revisao.length === 1 ? original.revisao : 'A'
  const originalLetter = parsedLetter > revisaoLetter ? parsedLetter : revisaoLetter

  const { data: existingVersions } = await supabase
    .from(TABLE)
    .select('numero_proposta, revisao')
    .ilike('numero_proposta', `${baseId}%`)

  let maxLetter = originalLetter
  for (const v of existingVersions ?? []) {
    const parsed = parseVersionedNumero(v.numero_proposta)
    if (parsed.base === baseId && parsed.letter > maxLetter) {
      maxLetter = parsed.letter
    }
    if (v.revisao && v.revisao.length === 1 && v.revisao > maxLetter) {
      maxLetter = v.revisao
    }
  }

  const newLetter = nextVersionLetter(maxLetter)
  const newNumero = `${baseId}-${newLetter}`
  const today = new Date().toISOString().split('T')[0]

  const versionChain = {
    versao_anterior: originalLetter,
    nova_versao: newLetter,
    proposta_original_id: originalId,
    data_criacao: new Date().toISOString(),
    editado_por: userName ?? 'Sistema',
  }

  const valorSemDesconto = payload.valor_sem_desconto ?? original.valor_sem_desconto ?? 0
  const percentualDesconto = payload.percentual_desconto ?? original.percentual_desconto ?? 0
  const valorAtual = payload.valor_atual ?? valorSemDesconto
  const valorFinal = payload.valor_final ?? valorAtual * (1 - percentualDesconto / 100)

  const targetProjeto = payload.projeto ?? original.projeto
  if (!targetProjeto) {
    throw new Error('A associação a um projeto é obrigatória para emitir a proposta.')
  }

  // Ponto 18 & Ponto 4: Validação no salvamento — Pacote exige tipo de proposta definido na primeira máquina
  // e tipos de proposta do mesmo método de fornecimento em todas as máquinas.
  const isPacoteVersion = payload.is_pacote !== undefined ? payload.is_pacote : original.is_pacote
  const itensParaValidar =
    payload.itens_snapshot !== undefined ? payload.itens_snapshot : original.itens_snapshot
  if (isPacoteVersion) {
    const itens = Array.isArray(itensParaValidar)
      ? (itensParaValidar as Array<{ tipo_proposta?: string; nome?: string }>)
      : []

    if (itens.length > 0) {
      const firstItem = itens[0]
      const firstTipo =
        (typeof firstItem?.tipo_proposta === 'string' && firstItem.tipo_proposta.trim()) ||
        (typeof payload.tipo_proposta === 'string' && payload.tipo_proposta.trim()) ||
        (typeof original.tipo_proposta === 'string' && original.tipo_proposta.trim()) ||
        ''

      if (!firstTipo) {
        throw new Error(
          'Selecione o tipo de proposta da primeira máquina para salvar a proposta pacote.',
        )
      }

      const getGroup = (t: string) => {
        const lower = t.toLowerCase()
        if (lower.includes('importacao direta') || lower.includes('importação direta'))
          return 'Importação Direta'
        if (lower.includes('nacionalizada')) return 'Nacionalizada'
        return 'Outro'
      }

      const firstGroup = getGroup(firstTipo)
      for (let i = 1; i < itens.length; i++) {
        const itemTipo =
          typeof itens[i]?.tipo_proposta === 'string' ? itens[i].tipo_proposta!.trim() : ''
        if (!itemTipo) {
          throw new Error(
            `Selecione o tipo de proposta para a máquina "${itens[i].nome || `Item ${i + 1}`}" do pacote.`,
          )
        }
        if (getGroup(itemTipo) !== firstGroup) {
          throw new Error(
            'Pacotes só aceitam máquinas com o mesmo tipo de fornecimento. Verifique os tipos de proposta selecionados para cada equipamento.',
          )
        }
        // Ponto 19 (Filtro Fino): Todas as máquinas seguintes herdam e devem ter exatamente o tipo da primeira máquina
        if (itemTipo !== firstTipo) {
          throw new Error(
            `Esta máquina não possui o tipo de proposta selecionado neste pacote (${firstTipo}). Cadastre o tipo na máquina ou remova-a do pacote.`,
          )
        }
      }
    }
  }

  const insertPayload = {
    ...payload,
    // Locked fields — always copied from original
    cliente: original.cliente,
    contato_id: payload.contato_id !== undefined ? payload.contato_id : original.contato_id,
    tipo_proposta:
      payload.tipo_proposta !== undefined ? payload.tipo_proposta : original.tipo_proposta,
    is_pacote: payload.is_pacote !== undefined ? payload.is_pacote : original.is_pacote,
    representante:
      payload.representante !== undefined ? payload.representante : original.representante,
    gerente: payload.gerente !== undefined ? payload.gerente : original.gerente,
    versao: payload.versao ?? original.versao,
    modelo_licitacao: original.modelo_licitacao,
    numero_proposta: newNumero,
    revisao: newLetter,
    versoes_comparacao: versionChain,
    versao_original: originalId,
    valor_sem_desconto: valorSemDesconto,
    valor_final: valorFinal,
    preco_especial:
      payload.preco_especial !== undefined ? payload.preco_especial : original.preco_especial,
    valor_atual: valorAtual,
    cliente_original: original.cliente_original ?? original.clientes?.fantasia ?? null,
    representante_original:
      original.representante_original ?? original.representantes?.fantasia ?? null,
    gerente_original: original.gerente_original ?? original.gerentes?.nome ?? null,
    assinante_representante_id:
      payload.assinante_representante_id !== undefined
        ? payload.assinante_representante_id
        : payload.representante !== undefined
          ? payload.representante
          : (original.assinante_representante_id ?? original.representante),
    assinante_gerente_id:
      payload.assinante_gerente_id !== undefined
        ? payload.assinante_gerente_id
        : payload.gerente !== undefined
          ? payload.gerente
          : (original.assinante_gerente_id ?? original.gerente),
    assinatura_cliente: null,
    assinatura_representante: null,
    assinatura_gerente_produto: null,
    assinatura_assessor_tecnico: null,
    assinado_por_representante: null,
    assinado_por_gerente: null,
    data_assinatura_representante: null,
    data_assinatura_gerente: null,
    secoes_adicionais: payload.secoes_adicionais ?? original.secoes_adicionais,
    transporte_seguro: payload.transporte_seguro ?? original.transporte_seguro,
    imposto_ipi: payload.imposto_ipi ?? original.imposto_ipi,
    imposto_icms: payload.imposto_icms ?? original.imposto_icms,
    garantia_acessorios: payload.garantia_acessorios ?? original.garantia_acessorios,
    assistencia_tecnica_detalhada:
      payload.assistencia_tecnica_detalhada ?? original.assistencia_tecnica_detalhada,
    frase_preco:
      payload.frase_preco ?? (original as unknown as Record<string, unknown>).frase_preco ?? null,
    frase_comissao:
      payload.frase_comissao ??
      (original as unknown as Record<string, unknown>).frase_comissao ??
      null,
    treinamento_tecnico:
      payload.treinamento_tecnico ??
      (original as unknown as Record<string, unknown>).treinamento_tecnico ??
      null,
    campos_adicionais: payload.campos_adicionais ?? original.campos_adicionais,
    tipo_proposta_override:
      payload.tipo_proposta_override !== undefined
        ? payload.tipo_proposta_override
        : (original.tipo_proposta_override ?? null),
    itens_snapshot:
      payload.itens_snapshot !== undefined
        ? payload.itens_snapshot
        : (original.itens_snapshot ?? null),
    dados_snapshot:
      payload.dados_snapshot !== undefined
        ? payload.dados_snapshot
        : (original.dados_snapshot ?? null),
    status: 'Em Analise',
    dt_cad: today,
    user: userName ?? 'Sistema',
    data_alteracao_status: new Date().toISOString(),
    ultimo_usuario_status: userName ?? 'Sistema',
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(
      insertPayload as unknown as import('@/lib/supabase/types').Database['public']['Tables']['propostas']['Insert'],
    )
    .select()
    .single()
  if (error) throw new Error(error.message)

  const projetoId = payload.projeto ?? original.projeto
  if (userId && projetoId) {
    supabase
      .from('projeto_membros')
      .upsert(
        { projeto_id: projetoId, user_id: userId, papel: 'Colaborador' },
        { onConflict: 'projeto_id,user_id' },
      )
      .then(({ error: e }) => {
        if (e && e.code !== '23505') console.warn(e.message)
      })
  }

  return data as unknown as Proposta
}

export async function updateProposta(
  id: string,
  payload: Partial<PropostaInsert>,
  userName?: string,
): Promise<Proposta> {
  if (payload.is_pacote) {
    const itens = Array.isArray(payload.itens_snapshot)
      ? (payload.itens_snapshot as Array<{ tipo_proposta?: string; nome?: string }>)
      : []

    if (itens.length > 0) {
      const firstItem = itens[0]
      const firstTipo =
        (typeof firstItem?.tipo_proposta === 'string' && firstItem.tipo_proposta.trim()) ||
        (typeof payload.tipo_proposta === 'string' && payload.tipo_proposta.trim()) ||
        ''

      if (!firstTipo) {
        throw new Error(
          'Selecione o tipo de proposta da primeira máquina para salvar a proposta pacote.',
        )
      }

      const getGroup = (t: string) => {
        const lower = t.toLowerCase()
        if (lower.includes('importacao direta') || lower.includes('importação direta'))
          return 'Importação Direta'
        if (lower.includes('nacionalizada')) return 'Nacionalizada'
        return 'Outro'
      }

      const firstGroup = getGroup(firstTipo)
      for (let i = 1; i < itens.length; i++) {
        const itemTipo =
          typeof itens[i]?.tipo_proposta === 'string' ? itens[i].tipo_proposta!.trim() : ''
        if (!itemTipo) {
          throw new Error(
            `Selecione o tipo de proposta para a máquina "${itens[i].nome || `Item ${i + 1}`}" do pacote.`,
          )
        }
        if (getGroup(itemTipo) !== firstGroup) {
          throw new Error(
            'Pacotes só aceitam máquinas com o mesmo tipo de fornecimento. Verifique os tipos de proposta selecionados para cada equipamento.',
          )
        }
        // Ponto 19 (Filtro Fino): Todas as máquinas seguintes herdam e devem ter exatamente o tipo da primeira máquina
        if (itemTipo !== firstTipo) {
          throw new Error(
            `Esta máquina não possui o tipo de proposta selecionado neste pacote (${firstTipo}). Cadastre o tipo na máquina ou remova-a do pacote.`,
          )
        }
      }
    }
  }

  const updatePayload = { ...payload, user: userName ?? 'Sistema' }
  const { data, error } = await supabase
    .from(TABLE)
    .update(
      updatePayload as unknown as import('@/lib/supabase/types').Database['public']['Tables']['propostas']['Update'],
    )
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as unknown as Proposta
}

export async function updatePropostaStatus(
  id: string,
  status: string,
  userName?: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      status,
      data_alteracao_status: new Date().toISOString(),
      ultimo_usuario_status: userName ?? 'Sistema',
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteProposta(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function uploadSignature(file: Blob, prefix: string): Promise<string> {
  const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.png`
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(fileName, file)
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName)
  return data.publicUrl
}

/**
 * Uploads a signature that may already be a remote URL or a base64 Data URL.
 * If signatureValue starts with 'data:image/', it converts it to a PNG Blob and uploads to storage.
 * If signatureValue is already an http(s) URL, returns it directly.
 * If null/empty, returns null.
 */
export async function uploadSignatureDataUrl(
  signatureValue: string | null | undefined,
  prefix = 'assinatura-representante',
): Promise<string | null> {
  if (!signatureValue || !signatureValue.trim()) return null
  const trimmed = signatureValue.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  if (!trimmed.startsWith('data:image/')) {
    return null
  }
  try {
    const response = await fetch(trimmed)
    const blob = await response.blob()
    const url = await uploadSignature(blob, prefix)
    return url
  } catch (err) {
    console.warn('[uploadSignatureDataUrl] falha ao converter data URL e fazer upload:', err)
    // Fallback: return trimmed so proposal is not blocked
    return trimmed
  }
}

export async function validateProposta(id: string, signatureBlob: Blob): Promise<void> {
  const signatureUrl = await uploadSignature(signatureBlob, 'assinatura-cliente')
  const { error } = await supabase
    .from(TABLE)
    .update({
      assinatura_cliente: signatureUrl,
      status: 'Validada',
      data_alteracao_status: new Date().toISOString(),
      ultimo_usuario_status: 'Cliente',
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Fetches a proposal safely via the public Edge Function using public_token or id.
 * Anon clients CANNOT query the `propostas` table directly (RLS blocks anon).
 */
export async function fetchPublicProposta(
  tokenOrId: string,
): Promise<PropostaWithRelations | null> {
  try {
    const { data, error } = await supabase.functions.invoke('public-proposal', {
      body: { token: tokenOrId, id: tokenOrId },
    })
    if (error || !data?.data) {
      console.warn('[fetchPublicProposta] error invoking public-proposal:', error || data?.error)
      return null
    }
    return data.data as PropostaWithRelations
  } catch (err) {
    console.error('[fetchPublicProposta] failed:', err)
    return null
  }
}

/**
 * Publicly validates/signs a proposal via the public Edge Function using public_token or id.
 */
export async function validatePublicProposta(
  tokenOrId: string,
  signatureDataUrl: string,
): Promise<{ success: boolean; signature_url?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('public-proposal', {
      body: {
        token: tokenOrId,
        id: tokenOrId,
        action: 'validate',
        signature_data_url: signatureDataUrl,
      },
    })
    if (error || !data?.success) {
      return {
        success: false,
        error: (error?.message || data?.error) ?? 'Erro ao validar proposta.',
      }
    }
    return { success: true, signature_url: data.signature_url }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro ao validar proposta.',
    }
  }
}
