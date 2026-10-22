import { supabase } from '@/lib/supabase/client'
import {
  Cliente,
  ClienteInsert,
  ClienteUpdate,
  ClienteContato,
  ClienteContatoInput,
} from '@/types/cliente'

const TABLE = 'clientes'
const TABLE_CONTATOS = 'cliente_contatos'

export async function fetchClientes(options?: {
  estado?: string | null
  estados?: string[] | null
  criadoPor?: string | null
  /** Se true com criadoPor e estado/estados fornecidos, retorna clientes criados por criadoPor OU com os estados indicados */
  matchAny?: boolean
}): Promise<Cliente[]> {
  let query = supabase.from(TABLE).select('*').order('created_at', { ascending: false })

  // Normalizar lista de estados (tanto se vier por array quanto por string separada por vírgula)
  const rawList: string[] = []
  if (Array.isArray(options?.estados)) {
    rawList.push(...options.estados)
  }
  if (options?.estado) {
    rawList.push(...options.estado.split(','))
  }
  const cleanEstados = Array.from(
    new Set(rawList.map((s) => s.trim().toUpperCase()).filter((s) => s.length > 0)),
  )

  const cleanCriadoPor = options?.criadoPor?.trim()

  if (options?.matchAny && cleanCriadoPor && cleanEstados.length > 0) {
    // União: criados por ele OU de algum dos seus estados de atuação
    const estadoClauses = cleanEstados.map((uf) => `estado.ilike.${uf}`).join(',')
    query = query.or(`criado_por.eq.${cleanCriadoPor},${estadoClauses}`)
  } else {
    if (cleanEstados.length > 1) {
      query = query.in('estado', cleanEstados)
    } else if (cleanEstados.length === 1) {
      query = query.ilike('estado', cleanEstados[0])
    }
    if (cleanCriadoPor) {
      query = query.eq('criado_por', cleanCriadoPor)
    }
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  const clientes = (data ?? []) as unknown as Cliente[]

  // Enriquecer com nomes dos criadores e autores de máquina de interesse (visível para todos - R9)
  try {
    const userIds = new Set<string>()
    clientes.forEach((c) => {
      if (c.criado_por) userIds.add(c.criado_por)
      if (c.maquina_interesse_adicionada_por) userIds.add(c.maquina_interesse_adicionada_por)
    })
    if (userIds.size > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', Array.from(userIds))
      const nameMap = new Map<string, string>()
      ;(profs || []).forEach((p: { id: string; name: string | null }) => {
        if (p.name) nameMap.set(p.id, p.name)
      })
      clientes.forEach((c) => {
        if (c.criado_por) c.criador_nome = nameMap.get(c.criado_por) || null
        if (c.maquina_interesse_adicionada_por) {
          c.maquina_interesse_autor_nome = nameMap.get(c.maquina_interesse_adicionada_por) || null
        }
      })
    }
  } catch (err) {
    console.warn('Erro ao enriquecer auditoria de clientes:', err)
  }

  return clientes
}

export async function fetchClienteById(id: string): Promise<Cliente | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single()

  if (error) throw new Error(error.message)
  const cliente = data as unknown as Cliente

  // Enriquecer auditoria
  try {
    const ids = [cliente.criado_por, cliente.maquina_interesse_adicionada_por].filter(
      Boolean,
    ) as string[]
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ids)
      const nameMap = new Map<string, string>()
      ;(profs || []).forEach((p: { id: string; name: string | null }) => {
        if (p.name) nameMap.set(p.id, p.name)
      })
      if (cliente.criado_por) cliente.criador_nome = nameMap.get(cliente.criado_por) || null
      if (cliente.maquina_interesse_adicionada_por) {
        cliente.maquina_interesse_autor_nome =
          nameMap.get(cliente.maquina_interesse_adicionada_por) || null
      }
    }
  } catch {
    // ignora
  }

  return cliente
}

// ----------------------------------------------------------------------------
// R8: Múltiplos Contatos do Cliente (tabela cliente_contatos)
// ----------------------------------------------------------------------------
export async function fetchContatosByCliente(clienteId: string): Promise<ClienteContato[]> {
  if (!clienteId) return []
  const { data, error } = await supabase
    .from(TABLE_CONTATOS)
    .select('*')
    .eq('cliente_id', clienteId)
    .order('is_principal', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erro ao buscar contatos do cliente:', error)
    return []
  }
  return (data ?? []) as ClienteContato[]
}

export async function syncClienteContatos(
  clienteId: string,
  contatos: ClienteContatoInput[],
): Promise<void> {
  if (!clienteId) return

  // Validação: garantir que apenas um contato seja principal (ou o primeiro se nenhum for)
  const cleanList = contatos
    .filter((c) => (c.nome && c.nome.trim().length > 0) || c.email || c.telefone)
    .map((c, idx) => ({
      ...c,
      nome: c.nome?.trim() || `Contato ${idx + 1}`,
      email: c.email?.trim() || null,
      telefone: c.telefone?.trim() || null,
      cargo: c.cargo?.trim() || null,
      is_principal: !!c.is_principal,
    }))

  if (cleanList.length > 0 && !cleanList.some((c) => c.is_principal)) {
    cleanList[0].is_principal = true
  }

  // Deleta contatos antigos e reinsere atualizados
  const { error: delError } = await supabase
    .from(TABLE_CONTATOS)
    .delete()
    .eq('cliente_id', clienteId)

  if (delError) {
    console.error('Erro ao limpar contatos anteriores do cliente:', delError)
  }

  if (cleanList.length === 0) return

  const rowsToInsert = cleanList.map((c) => ({
    cliente_id: clienteId,
    nome: c.nome,
    email: c.email,
    telefone: c.telefone,
    cargo: c.cargo,
    is_principal: c.is_principal,
  }))

  const { error: insError } = await supabase.from(TABLE_CONTATOS).insert(rowsToInsert)
  if (insError) {
    throw new Error(`Erro ao salvar contatos do cliente: ${insError.message}`)
  }
}

export async function checkDocumentoDuplicate(
  documento: string,
  excludeId?: string,
): Promise<boolean> {
  if (!documento || documento.replace(/\D/g, '').length < 11) return false
  let query = supabase.from(TABLE).select('id').eq('documento', documento)
  if (excludeId) {
    query = query.neq('id', excludeId)
  }
  const { data, error } = await query.maybeSingle()
  if (error) return false
  return !!data
}

export async function insertCliente(payload: ClienteInsert): Promise<Cliente> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(
      payload as unknown as import('@/lib/supabase/types').Database['public']['Tables']['clientes']['Insert'],
    )
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as unknown as Cliente
}

export async function updateCliente(payload: ClienteUpdate): Promise<Cliente> {
  const { id, ...rest } = payload
  const { data, error } = await supabase
    .from(TABLE)
    .update(
      rest as unknown as import('@/lib/supabase/types').Database['public']['Tables']['clientes']['Update'],
    )
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as unknown as Cliente
}

export async function deleteCliente(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export interface CnpjLookupResult {
  razao_social: string
  nome_fantasia: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  uf: string
  cep: string
  email: string
  ddd: string
  telefone: string
  contato?: string
  origem?: string
  campos_base_antiga?: Record<string, boolean>
}

export async function lookupCnpj(cnpj: string): Promise<CnpjLookupResult | null> {
  const cleanCnpj = cnpj.replace(/\D/g, '')
  if (cleanCnpj.length !== 14) return null

  const { data, error } = await supabase.functions.invoke('cnpj-lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { cnpj: cleanCnpj },
  })

  if (error || !data || data.error) return null
  return data as CnpjLookupResult
}

export interface CepLookupResult {
  estado: string
  cidade: string
  bairro: string
  logradouro: string
  complemento: string
  origem?: string
}

export interface BatchCepLookupResult {
  processed: number
  updated: number
  skipped: number
  remaining: number
  next_offset?: number
  error?: string
}

export async function lookupCep(cep: string): Promise<CepLookupResult | null> {
  const cleanCep = cep.replace(/\D/g, '')
  if (cleanCep.length !== 8) return null

  const { data, error } = await supabase.functions.invoke('cep-lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { cep: cleanCep },
  })

  if (error || !data || data.error) return null
  return {
    estado: data.estado ?? '',
    cidade: data.cidade ?? '',
    bairro: data.bairro ?? '',
    logradouro: data.logradouro ?? '',
    complemento: data.complemento ?? '',
    origem: data.origem,
  }
}

export async function executeBatchCepLookup(limit: number = 50): Promise<BatchCepLookupResult> {
  const { data, error } = await supabase.functions.invoke('batch-cep-lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { limit },
  })

  if (error) {
    throw new Error(error.message || 'Erro ao invocar busca de CEP em lote.')
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return data as BatchCepLookupResult
}

export async function countPendingCepClientes(): Promise<number> {
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .not('cep', 'is', null)
    .neq('cep', '')
    .or('logradouro.is.null,logradouro.eq.,logradouro.not.match.[A-Za-zÀ-ÿ]')

  if (error) {
    console.error('Erro ao contar clientes com CEP pendente:', error)
    return 0
  }

  return count ?? 0
}
