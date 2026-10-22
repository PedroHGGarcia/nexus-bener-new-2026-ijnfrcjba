import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

interface ClienteInput {
  nome?: string
  nome_fantasia?: string
  fantasia?: string
  cnpj?: string
  email?: string
  telefone?: string
  contato?: string
  endereco?: string
  cidade?: string
  uf?: string
  cep?: string
}

async function verifyAdmin(authHeader: string) {
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || '').toLowerCase()
  if (role !== 'admin completo' && role !== 'admin') {
    return null
  }
  return user
}

function cleanCnpjStr(cnpj?: string): string {
  if (!cnpj) return ''
  return cnpj.replace(/\D/g, '')
}

function cleanCepStr(cep?: string): string {
  if (!cep) return ''
  return cep.replace(/\D/g, '')
}

/**
 * Validação rigorosa de CNPJ real (14 dígitos e dois dígitos verificadores válidos).
 * Rejeita CNPJs com todos os dígitos iguais e cálculos inválidos.
 */
export function isValidCNPJ(cnpj?: string): boolean {
  if (!cnpj) return false
  const digits = cleanCnpjStr(cnpj)
  if (digits.length !== 14) return false
  if (/^(\d)\1{13}$/.test(digits)) return false

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * weights1[i]
  }
  const digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (parseInt(digits[12], 10) !== digit1) return false

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  sum = 0
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i], 10) * weights2[i]
  }
  const digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (parseInt(digits[13], 10) !== digit2) return false

  return true
}

/**
 * Normaliza uma string de Razão Social ou Nome Fantasia para correspondência:
 * - trim e minúsculas
 * - remoção de acentos (NFD)
 * - remoção de pontuação e caracteres não alfanuméricos
 * - colapso de espaços múltiplos
 */
export function normalizeRazaoSocial(nome?: string): string {
  if (!nome) return ''
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normaliza removendo também espaços internos para comparação de compactação
 */
export function normalizeCompact(nome?: string): string {
  return normalizeRazaoSocial(nome).replace(/\s+/g, '')
}

/**
 * Lista de termos genéricos / sufixos societários comuns que sozinhos
 * não devem identificar uma empresa.
 */
const GENERIC_COMPANY_TERMS = new Set([
  'ltda',
  'sa',
  's a',
  'me',
  'epp',
  'eireli',
  'empresa',
  'cliente',
  'diversos',
  'balcao',
  'consumidor',
  'sem nome',
  'nao informado',
  'teste',
])

/**
 * Regra para evitar falsos positivos:
 * A correspondência por Razão Social ou Fantasia só é aplicada quando o nome for
 * razoavelmente específico:
 * 1. Pelo menos 3 caracteres após a normalização.
 * 2. Não pertencer à lista de termos genéricos isolados.
 * 3. Ter pelo menos 3 caracteres excluindo dígitos, ou ser um código alfanumérico identificável.
 */
export function isSpecificRazaoSocial(nome?: string): boolean {
  const norm = normalizeRazaoSocial(nome)
  if (!norm || norm.length < 3) return false
  if (GENERIC_COMPANY_TERMS.has(norm)) return false
  const withoutDigits = norm.replace(/\d/g, '').trim()
  if (withoutDigits.length < 3 && !/^[a-z0-9]{3,}$/i.test(norm)) return false
  return true
}

/**
 * Distância de Levenshtein iterativa com duas linhas (O(min(N, M)) espaço).
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  if (a.length < b.length) {
    const tmp = a
    a = b
    b = tmp
  }

  const bLen = b.length
  let prevRow = new Array<number>(bLen + 1)
  let currRow = new Array<number>(bLen + 1)

  for (let j = 0; j <= bLen; j++) {
    prevRow[j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    currRow[0] = i
    const aChar = a.charCodeAt(i - 1)
    for (let j = 1; j <= bLen; j++) {
      const cost = aChar === b.charCodeAt(j - 1) ? 0 : 1
      currRow[j] = Math.min(currRow[j - 1] + 1, prevRow[j] + 1, prevRow[j - 1] + cost)
    }
    const temp = prevRow
    prevRow = currRow
    currRow = temp
  }

  return prevRow[bLen]
}

export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1.0
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1.0
  const dist = levenshteinDistance(a, b)
  return 1 - dist / maxLen
}

/**
 * Critério seguro de correspondência fuzzy para nomes empresariais.
 */
export function isFuzzyMatch(str1: string, str2: string): boolean {
  if (str1 === str2) return true

  const len1 = str1.length
  const len2 = str2.length
  const minLen = Math.min(len1, len2)
  const maxLen = Math.max(len1, len2)

  if (Math.abs(len1 - len2) > 3) return false
  if (minLen < 6) return false

  const dist = levenshteinDistance(str1, str2)

  let maxAllowedDist = 1
  let minSim = 0.88

  if (maxLen >= 13 && maxLen <= 24) {
    maxAllowedDist = 2
    minSim = 0.9
  } else if (maxLen > 24) {
    maxAllowedDist = 3
    minSim = 0.9
  }

  if (dist <= maxAllowedDist) {
    const sim = 1 - dist / maxLen
    if (sim >= minSim) return true
  }

  const compact1 = str1.replace(/\s+/g, '')
  const compact2 = str2.replace(/\s+/g, '')
  if (compact1.length >= 6 && compact2.length >= 6) {
    const compactDist = levenshteinDistance(compact1, compact2)
    if (compactDist === 0) return true
    if (compactDist === 1 && Math.max(compact1.length, compact2.length) >= 8) {
      return true
    }
  }

  return false
}

function makeContactKey(
  clienteId: string,
  nome?: string | null,
  tel?: string | null,
  mail?: string | null,
) {
  const c = clienteId.trim()
  const n = (nome || '').trim().toLowerCase()
  const t = (tel || '').trim().replace(/\D/g, '') || (tel || '').trim().toLowerCase()
  const m = (mail || '').trim().toLowerCase()
  return `${c}__${n}__${t}__${m}`
}

// Cache em memória na instância da edge function para clientes cadastrados
let memoryDbClientsCache: Array<{
  id: string
  nome: string | null
  cnpj: string | null
  normNome: string
  isSpecificNome: boolean
}> | null = null
let lastCacheTime = 0
const CACHE_TTL_MS = 60_000 // 1 minuto

async function getOrLoadAllDbClients(adminClient: any) {
  const now = Date.now()
  if (memoryDbClientsCache && now - lastCacheTime < CACHE_TTL_MS) {
    return memoryDbClientsCache
  }

  const allRows: Array<{ id: string; nome: string | null; cnpj: string | null }> = []
  const pageSize = 1000
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await adminClient
      .from('clientes_base_antiga')
      .select('id, nome, cnpj')
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('Erro ao carregar candidatos em memória:', error.message)
      break
    }

    if (data && data.length > 0) {
      allRows.push(...data)
      from += data.length
      if (data.length < pageSize) {
        hasMore = false
      }
    } else {
      hasMore = false
    }
  }

  memoryDbClientsCache = allRows.map((r) => {
    const normNome = normalizeRazaoSocial(r.nome || '')
    const isSpecificNome = isSpecificRazaoSocial(r.nome || '')
    return {
      id: r.id,
      nome: r.nome,
      cnpj: r.cnpj,
      normNome,
      isSpecificNome,
    }
  })
  lastCacheTime = now
  return memoryDbClientsCache
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado. Token de autenticação ausente.' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    const adminUser = await verifyAdmin(authHeader)
    if (!adminUser) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    const body = await req.json().catch(() => ({}))
    const rawList = Array.isArray(body)
      ? body
      : Array.isArray(body.clientes)
        ? body.clientes
        : Array.isArray(body.registros)
          ? body.registros
          : []
    const clientes: ClienteInput[] = rawList

    if (clientes.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum registro de cliente enviado.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    if (clientes.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Limite máximo de 500 registros por chamada excedido.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Preparar registros válidos:
    // CNPJ real com dígito verificador válido; se inválido ou ausente, cnpjReal = null
    interface ParsedRow {
      nome: string
      fantasia: string
      cnpj: string | null // apenas CNPJ real válido; se inválido ou ausente => null
      rawCnpj: string
      cnpjValido: boolean
      email: string
      telefone: string
      contato: string
      endereco: string
      cidade: string
      uf: string
      cep: string
      updated_at: string
      normNome: string
      normFantasia: string
      isSpecificNome: boolean
      isSpecificFantasia: boolean
    }

    const validRows: ParsedRow[] = []
    let cnpjsInvalidosCount = 0

    for (const c of clientes) {
      const rawCnpjDigits = cleanCnpjStr(c.cnpj)
      let cnpjReal: string | null = null
      let cnpjValido = false

      if (rawCnpjDigits.length > 0) {
        if (isValidCNPJ(rawCnpjDigits)) {
          cnpjReal = rawCnpjDigits
          cnpjValido = true
        } else {
          // Contar como inválido e tratar como "sem CNPJ"
          cnpjsInvalidosCount++
          cnpjReal = null
          cnpjValido = false
        }
      }

      const nome = (c.nome || '').trim()
      const fantasia = (c.nome_fantasia || c.fantasia || '').trim()

      const normNome = normalizeRazaoSocial(nome)
      const normFantasia = normalizeRazaoSocial(fantasia)
      const specificNome = isSpecificRazaoSocial(nome)
      const specificFantasia = isSpecificRazaoSocial(fantasia)

      // Regra de descarte: precisa ter CNPJ válido OU Razão Social / Nome Fantasia com >= 3 caracteres
      if (!cnpjReal && normNome.length < 3 && normFantasia.length < 3) {
        continue
      }

      const finalNome = nome || fantasia
      const finalNormNome = normNome || normFantasia
      const finalSpecificNome = specificNome || specificFantasia

      const uf = (c.uf || '').trim().toUpperCase().slice(0, 2)
      validRows.push({
        nome: finalNome,
        fantasia,
        cnpj: cnpjReal,
        rawCnpj: rawCnpjDigits,
        cnpjValido,
        email: (c.email || '').trim(),
        telefone: (c.telefone || '').trim(),
        contato: (c.contato || '').trim(),
        endereco: (c.endereco || '').trim(),
        cidade: (c.cidade || '').trim(),
        uf,
        cep: cleanCepStr(c.cep),
        updated_at: new Date().toISOString(),
        normNome: finalNormNome,
        normFantasia,
        isSpecificNome: finalSpecificNome,
        isSpecificFantasia: specificFantasia,
      })
    }

    if (validRows.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            'Nenhum registro continha CNPJ real válido ou Razão Social / Nome Fantasia válida (mínimo 3 caracteres).',
          inseridos: 0,
          atualizados: 0,
          total: 0,
          cnpjs_invalidos: cnpjsInvalidosCount,
          cnpjs_validos: 0,
          cnpjs_unicos: 0,
          ignorados: clientes.length,
          contatos_adicionados: 0,
          contatos_duplicados: 0,
          casamentos_cnpj: 0,
          casamentos_razao_exata: 0,
          casamentos_fuzzy: 0,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    // =========================================================================
    // ETAPA 1: Consultar clientes existentes no banco para candidatos
    // =========================================================================
    const allDbCandidates = await getOrLoadAllDbClients(adminClient)

    interface TargetClient {
      id: string // uuid existente ou gerado
      isExisting: boolean
      needsDbUpdate: boolean
      cnpj: string | null
      receita_status: string
      nome: string
      email: string
      telefone: string
      contato: string
      endereco: string
      cidade: string
      uf: string
      cep: string
      updated_at: string
      normNome: string
      normFantasia?: string
    }

    // Mapas rápidos de clientes:
    // - por CNPJ: cnpj -> TargetClient
    // - por Razão Social/Fantasia normalizada: normNome -> TargetClient
    const clientsByCnpj = new Map<string, TargetClient>()
    // Para Razão Social ou Fantasia, mantemos listas se houver mais de um candidato
    // dando prioridade para clientes COM CNPJ
    const clientsByNormNomeList = new Map<string, TargetClient[]>()

    const targetClientsList: TargetClient[] = []

    for (const dbRow of allDbCandidates) {
      const tc: TargetClient = {
        id: dbRow.id,
        isExisting: true,
        needsDbUpdate: false,
        cnpj: dbRow.cnpj || null,
        receita_status: dbRow.cnpj ? 'pendente' : 'sem_cnpj',
        nome: dbRow.nome || '',
        email: '',
        telefone: '',
        contato: '',
        endereco: '',
        cidade: '',
        uf: '',
        cep: '',
        updated_at: new Date().toISOString(),
        normNome: dbRow.normNome,
      }

      if (dbRow.cnpj) {
        clientsByCnpj.set(dbRow.cnpj, tc)
      }
      if (dbRow.isSpecificNome && tc.normNome) {
        const arr = clientsByNormNomeList.get(tc.normNome) || []
        // Clientes com CNPJ ficam na frente da lista de prioridade
        if (tc.cnpj) {
          arr.unshift(tc)
        } else {
          arr.push(tc)
        }
        clientsByNormNomeList.set(tc.normNome, arr)
      }
      targetClientsList.push(tc)
    }

    // Helper para escolher o melhor TargetClient entre candidatos de mesmo nome/fantasia:
    // SEMPRE prioriza o cliente que TEM CNPJ
    function pickBestClient(candidates: TargetClient[] | undefined): TargetClient | null {
      if (!candidates || candidates.length === 0) return null
      const withCnpj = candidates.find((c) => Boolean(c.cnpj && c.cnpj.trim().length > 0))
      return withCnpj || candidates[0]
    }

    function registerClientName(name: string, client: TargetClient) {
      if (!name) return
      const arr = clientsByNormNomeList.get(name) || []
      if (!arr.includes(client)) {
        if (client.cnpj) {
          arr.unshift(client)
        } else {
          arr.push(client)
        }
        clientsByNormNomeList.set(name, arr)
      }
    }

    // =========================================================================
    // ETAPA 2: Correspondência em três fases:
    // Prioridade 1: CNPJ real válido
    // Prioridade 2: Razão Social ou Fantasia Exata Normalizada (priorizando alvo com CNPJ)
    // Prioridade 3: Correspondência Aproximada (Fuzzy: 1 letra diferente)
    // =========================================================================
    let casamentosCnpj = 0
    let casamentosRazaoExata = 0
    let casamentosFuzzy = 0
    let cnpjsValidosBatch = 0

    const rowAssignments: Array<{
      row: ParsedRow
      client: TargetClient
      matchType: 'cnpj' | 'razao_exata' | 'fuzzy' | 'novo'
    }> = []

    for (const row of validRows) {
      if (row.cnpj) {
        cnpjsValidosBatch++
      }

      let matchedClient: TargetClient | null = null
      let matchType: 'cnpj' | 'razao_exata' | 'fuzzy' | 'novo' = 'novo'

      // 1. Prioridade CNPJ: se a linha tem CNPJ e ele casa com cliente existente/batch
      if (row.cnpj && clientsByCnpj.has(row.cnpj)) {
        matchedClient = clientsByCnpj.get(row.cnpj)!
        matchType = 'cnpj'
        casamentosCnpj++
      }

      // 2. Fallback pela Razão Social / Fantasia Exata Normalizada:
      // se CNPJ não foi informado / inválido OU não casou por CNPJ ainda
      if (!matchedClient) {
        if (row.isSpecificNome && clientsByNormNomeList.has(row.normNome)) {
          matchedClient = pickBestClient(clientsByNormNomeList.get(row.normNome))
          if (matchedClient) {
            matchType = 'razao_exata'
            casamentosRazaoExata++
          }
        } else if (
          row.isSpecificFantasia &&
          row.normFantasia &&
          clientsByNormNomeList.has(row.normFantasia)
        ) {
          matchedClient = pickBestClient(clientsByNormNomeList.get(row.normFantasia))
          if (matchedClient) {
            matchType = 'razao_exata'
            casamentosRazaoExata++
          }
        }
      }

      // 3. Fallback pela correspondência FUZZY (Aproximada):
      if (!matchedClient && (row.isSpecificNome || row.isSpecificFantasia)) {
        const queryNorms = [
          row.isSpecificNome ? row.normNome : null,
          row.isSpecificFantasia && row.normFantasia ? row.normFantasia : null,
        ].filter(Boolean) as string[]

        let bestClient: TargetClient | null = null
        let bestDistance = 999

        for (const candidate of targetClientsList) {
          if (!candidate.normNome || candidate.normNome.length < 5) continue

          for (const qNorm of queryNorms) {
            if (Math.abs(candidate.normNome.length - qNorm.length) > 3) continue

            if (isFuzzyMatch(qNorm, candidate.normNome)) {
              const d = levenshteinDistance(qNorm, candidate.normNome)
              // Se tiver menor distância ou se tiver a mesma distância mas o candidato TEM CNPJ
              const isBetter =
                d < bestDistance ||
                (d === bestDistance && Boolean(candidate.cnpj) && (!bestClient || !bestClient.cnpj))
              if (isBetter) {
                bestDistance = d
                bestClient = candidate
              }
            }
          }

          if (bestClient && bestDistance <= 1 && bestClient.cnpj) {
            break
          }
        }

        if (bestClient) {
          matchedClient = bestClient
          matchType = 'fuzzy'
          casamentosFuzzy++
        }
      }

      // 4. Se ainda não casou, cria novo cliente
      if (!matchedClient) {
        const newId = crypto.randomUUID()
        const newClient: TargetClient = {
          id: newId,
          isExisting: false,
          needsDbUpdate: true,
          cnpj: row.cnpj || null,
          receita_status: row.cnpj ? 'pendente' : 'sem_cnpj',
          nome: row.nome,
          email: row.email,
          telefone: row.telefone,
          contato: row.contato,
          endereco: row.endereco,
          cidade: row.cidade,
          uf: row.uf,
          cep: row.cep,
          updated_at: row.updated_at,
          normNome: row.normNome,
          normFantasia: row.normFantasia,
        }
        matchedClient = newClient
        matchType = 'novo'

        if (row.cnpj) {
          clientsByCnpj.set(row.cnpj, newClient)
        }
        if (row.isSpecificNome) {
          registerClientName(row.normNome, newClient)
        }
        if (row.isSpecificFantasia && row.normFantasia) {
          registerClientName(row.normFantasia, newClient)
        }
        targetClientsList.push(newClient)
      } else {
        // Regra do usuário: "Pode ser que um tenha cnpj e o outro nao, mas eles conseguem
        // se cruzar pelo nome fantasia ou pela razao social, quando for assim junte os
        // contatos no cliente que tiver CNPJ."
        // Se a linha ATUAL traz CNPJ real e o cliente encontrado NÃO tinha CNPJ,
        // promovemos o cliente adicionando o CNPJ real nele!
        if (row.cnpj && (!matchedClient.cnpj || matchedClient.cnpj.trim() === '')) {
          matchedClient.cnpj = row.cnpj
          matchedClient.receita_status = 'pendente'
          matchedClient.needsDbUpdate = true
          clientsByCnpj.set(row.cnpj, matchedClient)
        }

        // Complementa campos cadastrais do cliente se estiverem vazios
        if (matchedClient.isExisting) {
          let updated = false
          if (!matchedClient.nome && row.nome) {
            matchedClient.nome = row.nome
            updated = true
          }
          if (!matchedClient.cidade && row.cidade) {
            matchedClient.cidade = row.cidade
            updated = true
          }
          if (!matchedClient.uf && row.uf) {
            matchedClient.uf = row.uf
            updated = true
          }
          if (!matchedClient.endereco && row.endereco) {
            matchedClient.endereco = row.endereco
            updated = true
          }
          if (!matchedClient.cep && row.cep) {
            matchedClient.cep = row.cep
            updated = true
          }
          if (updated) {
            matchedClient.needsDbUpdate = true
          }
        }
      }

      rowAssignments.push({ row, client: matchedClient, matchType })
    }

    // =========================================================================
    // ETAPA 3: Persistir Clientes (Novos ou Atualizados)
    // =========================================================================
    const uniqueClients = Array.from(
      new Map(rowAssignments.map((ra) => [ra.client.id, ra.client])).values(),
    )

    const clientsToInsert = uniqueClients.filter((c) => !c.isExisting)
    const clientsToUpdate = uniqueClients.filter((c) => c.isExisting && c.needsDbUpdate)

    const inseridos = clientsToInsert.length
    const atualizados = uniqueClients.filter((c) => c.isExisting).length
    const cnpjsUnicos = uniqueClients.filter((c) => Boolean(c.cnpj)).length

    // Inserir novos clientes
    if (clientsToInsert.length > 0) {
      const insertPayload = clientsToInsert.map((c) => ({
        id: c.id,
        nome: c.nome,
        cnpj: c.cnpj || null,
        receita_status: c.receita_status,
        email: c.email || null,
        telefone: c.telefone || null,
        contato: c.contato || null,
        endereco: c.endereco || null,
        cidade: c.cidade || null,
        uf: c.uf || null,
        cep: c.cep || null,
        updated_at: c.updated_at,
      }))

      const { error: insertError } = await adminClient
        .from('clientes_base_antiga')
        .insert(insertPayload)

      if (insertError) {
        return new Response(
          JSON.stringify({
            error: `Erro ao inserir clientes novos em clientes_base_antiga: ${insertError.message}`,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }

      // Adiciona recém inseridos no cache em memória
      if (memoryDbClientsCache) {
        for (const c of clientsToInsert) {
          memoryDbClientsCache.push({
            id: c.id,
            nome: c.nome,
            cnpj: c.cnpj || null,
            normNome: c.normNome,
            isSpecificNome: isSpecificRazaoSocial(c.nome),
          })
        }
      }

      // Sincronizar com clientes_antigos para clientes que possuem CNPJ
      const antigosPayload = insertPayload
        .filter((p) => Boolean(p.cnpj))
        .map((p) => ({
          id: p.id,
          nome: p.nome,
          cnpj: p.cnpj,
          email: p.email,
          telefone: p.telefone,
          contato: p.contato,
          endereco: p.endereco,
          cidade: p.cidade,
          uf: p.uf,
          cep: p.cep,
          updated_at: p.updated_at,
        }))

      if (antigosPayload.length > 0) {
        await adminClient
          .from('clientes_antigos')
          .upsert(antigosPayload, { onConflict: 'cnpj', ignoreDuplicates: false })
      }
    }

    // Atualizar clientes existentes modificados
    if (clientsToUpdate.length > 0) {
      for (const c of clientsToUpdate) {
        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }
        if (c.nome) updatePayload.nome = c.nome
        if (c.cnpj) {
          updatePayload.cnpj = c.cnpj
          updatePayload.receita_status = 'pendente'
        }
        if (c.cidade) updatePayload.cidade = c.cidade
        if (c.uf) updatePayload.uf = c.uf
        if (c.endereco) updatePayload.endereco = c.endereco
        if (c.cep) updatePayload.cep = c.cep

        await adminClient.from('clientes_base_antiga').update(updatePayload).eq('id', c.id)

        if (c.cnpj) {
          const syncAntigo: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
            cnpj: c.cnpj,
          }
          if (c.nome) syncAntigo.nome = c.nome
          if (c.cidade) syncAntigo.cidade = c.cidade
          if (c.uf) syncAntigo.uf = c.uf
          if (c.endereco) syncAntigo.endereco = c.endereco
          if (c.cep) syncAntigo.cep = c.cep

          await adminClient.from('clientes_antigos').update(syncAntigo).eq('cnpj', c.cnpj)
        }
      }
    }

    // =========================================================================
    // ETAPA 4: Buscar contatos já existentes e inserir contatos desduplicados
    // Garantindo que todo contato vá para o cliente alvo (que terá CNPJ se algum tiver)
    // =========================================================================
    const clientIdsInBatch = uniqueClients.map((c) => c.id)

    const { data: existingContacts, error: contactsFetchError } = await adminClient
      .from('clientes_base_antiga_contatos')
      .select('id, cliente_base_antiga_id, cnpj, nome, telefone, email')
      .in('cliente_base_antiga_id', clientIdsInBatch)

    if (contactsFetchError) {
      return new Response(
        JSON.stringify({
          error: `Erro ao buscar contatos existentes: ${contactsFetchError.message}`,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    const seenContacts = new Set<string>()
    for (const ec of existingContacts || []) {
      if (ec.cliente_base_antiga_id) {
        seenContacts.add(makeContactKey(ec.cliente_base_antiga_id, ec.nome, ec.telefone, ec.email))
      }
    }

    let contatosAdicionados = 0
    let contatosDuplicados = 0
    const contactsToInsert: Array<{
      cliente_base_antiga_id: string
      cnpj: string | null
      nome: string | null
      telefone: string | null
      email: string | null
    }> = []

    for (const { row, client } of rowAssignments) {
      const nomeContato = row.contato || null
      const telContato = row.telefone || null
      const emailContato = row.email || null

      const hasAnyContactInfo = Boolean(nomeContato || telContato || emailContato)
      if (!hasAnyContactInfo) {
        continue
      }

      // Vincula SEMPRE ao client.id (que prioriza cliente com CNPJ)
      const key = makeContactKey(client.id, nomeContato, telContato, emailContato)
      if (seenContacts.has(key)) {
        contatosDuplicados++
      } else {
        seenContacts.add(key)
        contatosAdicionados++
        contactsToInsert.push({
          cliente_base_antiga_id: client.id,
          cnpj: client.cnpj || row.cnpj || null,
          nome: nomeContato,
          telefone: telContato,
          email: emailContato,
        })
      }
    }

    if (contactsToInsert.length > 0) {
      const { error: insertContactsError } = await adminClient
        .from('clientes_base_antiga_contatos')
        .insert(contactsToInsert)

      if (insertContactsError) {
        return new Response(
          JSON.stringify({
            error: `Erro ao salvar contatos em clientes_base_antiga_contatos: ${insertContactsError.message}`,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }
    }

    return new Response(
      JSON.stringify({
        inseridos,
        atualizados,
        total: uniqueClients.length,
        cnpjs_invalidos: cnpjsInvalidosCount,
        cnpjs_validos: cnpjsValidosBatch,
        cnpjs_unicos: cnpjsUnicos,
        ignorados: clientes.length - validRows.length,
        contatos_adicionados: contatosAdicionados,
        contatos_duplicados: contatosDuplicados,
        casamentos_cnpj: casamentosCnpj,
        casamentos_razao_exata: casamentosRazaoExata,
        casamentos_fuzzy: casamentosFuzzy,
      }),
      {
        headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
      },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }
})
