import { UserProfile } from '@/types'
import { Gerente } from '@/types/gerente'
import { isGerenteRole, isAdminRole } from '@/components/RoleGuard'

export interface CanDrawGerenteSignatureParams {
  /** Usuário logado atual (do useAuth ou objeto similar { id, email, role, name, gerente_id }) */
  user:
    | UserProfile
    | { id?: string; email?: string; role?: string; name?: string; gerente_id?: string | null }
    | null
    | undefined
  /** Objeto ou dados do gerente resolvido correspondente ao usuário logado (se for gerente) */
  userGerenteRecord?:
    | Gerente
    | {
        id?: string
        profile_id?: string | null
        email?: string | null
        nome?: string | null
        usuario?: string | null
      }
    | null
  /** Valor selecionado no formulário para 'gerente' (id) */
  selectedGerenteId?: string | null
  /** Valor selecionado no formulário para 'representante' (id ou 'gerente:ID') */
  selectedRepresentanteValue?: string | null
  /** Nome do gerente resolvido/selecionado */
  selectedGerenteNome?: string | null
  /** Objeto da proposta direta (para telas de detalhes, pós-geração, SignatureSection) */
  proposta?: {
    gerente?: string | null
    assinante_gerente_id?: string | null
    nome_gerente_produto?: string | null
    gerente_original?: string | null
    gerentes?: {
      id?: string
      nome?: string
      email?: string | null
      profile_id?: string | null
    } | null
    assinante_gerente?: {
      id?: string
      nome?: string
      email?: string | null
      profile_id?: string | null
    } | null
  } | null
  /** Lista de gerentes carregados no formulário/contexto */
  gerentesList?: Array<{
    id: string
    nome?: string
    email?: string | null
    profile_id?: string | null
    usuario?: string | null
  }>
}

/**
 * REGRA EXATA DO PRODUTO:
 * "Após eu gerar a proposta, eu tenho a opção de realizar a assinatura do gerente vinculado
 * naquela proposta, isso não deve acontecer, somente quem for o gerente que deve ter a
 * permissão para cadastrar a assinatura. Se não for ele ninguém deverá poder cadastrar uma assinatura."
 *
 * Regras estritas:
 * 1. O usuário logado DEVE ser um Gerente (role Gerente / gerente).
 *    - Usuário comum (representante, vendedor, usuário padrão): NÃO vê nem assina (false).
 *    - Administrador que não seja o gerente associado: NÃO vê nem assina (false).
 * 2. O usuário logado DEVE ser o gerente associado à proposta em questão.
 *    - Um gerente NÃO associado a esta proposta NÃO vê nem assina (false).
 * 3. A associação é verificada com base em:
 *    - A proposta já gravada (proposta.assinante_gerente_id, proposta.gerente, proposta.gerentes, etc.);
 *    - OU estado atual do formulário (selectedGerenteId, selectedRepresentanteValue);
 *    - Comparando os identificadores (id de gerente, profile_id, email, usuario, nome)
 *      do usuário logado com o gerente associado.
 */
export function canDrawGerenteSignature(params?: CanDrawGerenteSignatureParams | null): boolean {
  if (!params) return false

  const {
    user,
    userGerenteRecord,
    selectedGerenteId,
    selectedRepresentanteValue,
    selectedGerenteNome,
    proposta,
    gerentesList = [],
  } = params

  if (!user) return false

  // 1. O usuário DEVE possuir papel de Gerente (isGerenteRole).
  // Se for admin puro, vendedor, representante ou outro: NÃO pode cadastrar a assinatura do gerente.
  const role = typeof user.role === 'string' ? user.role : ''
  if (!isGerenteRole(role)) {
    return false
  }

  // 2. Identificar qual gerente está associado à proposta:
  let associatedGerenteId: string | null = null

  if (proposta) {
    associatedGerenteId =
      proposta.assinante_gerente_id ||
      proposta.gerente ||
      proposta.gerentes?.id ||
      proposta.assinante_gerente?.id ||
      null
  }

  const safeRepVal =
    typeof selectedRepresentanteValue === 'string' ? selectedRepresentanteValue.trim() : null

  if (!associatedGerenteId && safeRepVal?.startsWith('gerente:')) {
    associatedGerenteId = safeRepVal.replace('gerente:', '')
  } else if (!associatedGerenteId && safeRepVal && Array.isArray(gerentesList)) {
    const isGer = gerentesList.some(
      (g) => g?.id && typeof g.id === 'string' && g.id.toLowerCase() === safeRepVal.toLowerCase(),
    )
    if (isGer) {
      associatedGerenteId = safeRepVal
    }
  }

  if (!associatedGerenteId && selectedGerenteId && typeof selectedGerenteId === 'string') {
    associatedGerenteId = selectedGerenteId.trim()
  }

  const effectiveNomeGerente =
    (typeof selectedGerenteNome === 'string' && selectedGerenteNome.trim()) ||
    (typeof proposta?.nome_gerente_produto === 'string' && proposta.nome_gerente_produto.trim()) ||
    (typeof proposta?.gerentes?.nome === 'string' && proposta.gerentes.nome.trim()) ||
    (typeof proposta?.assinante_gerente?.nome === 'string' &&
      proposta.assinante_gerente.nome.trim()) ||
    (typeof proposta?.gerente_original === 'string' && proposta.gerente_original.trim()) ||
    null

  // Se nenhum gerente estiver associado à proposta:
  // Ninguém é o "gerente associado", portanto ninguém deve cadastrar assinatura.
  if (!associatedGerenteId && !effectiveNomeGerente) {
    return false
  }

  // Obter o objeto do gerente associado na proposta
  let associatedGerenteObj: {
    id: string
    nome?: string
    email?: string | null
    profile_id?: string | null
    usuario?: string | null
  } | null = null

  if (proposta?.gerentes?.id) {
    associatedGerenteObj = proposta.gerentes as typeof associatedGerenteObj
  } else if (proposta?.assinante_gerente?.id) {
    associatedGerenteObj = proposta.assinante_gerente as typeof associatedGerenteObj
  } else if (associatedGerenteId && Array.isArray(gerentesList)) {
    const targetId = associatedGerenteId.toLowerCase()
    associatedGerenteObj =
      gerentesList.find(
        (g) => g?.id && typeof g.id === 'string' && g.id.toLowerCase() === targetId,
      ) || null
  }

  // 3. Comparar o usuário logado com o gerente associado.
  // Critérios de identidade (com checagem segura de tipos):
  const userId = typeof user.id === 'string' ? user.id.toLowerCase().trim() : ''
  const userEmail = typeof user.email === 'string' ? user.email.toLowerCase().trim() : ''
  const userNome = typeof user.name === 'string' ? user.name.toLowerCase().trim() : ''
  const userGIdFromProfile =
    typeof user.gerente_id === 'string' ? user.gerente_id.toLowerCase().trim() : ''

  const logGerenteId =
    typeof userGerenteRecord?.id === 'string' ? userGerenteRecord.id.toLowerCase().trim() : ''
  const logGerenteProfileId =
    typeof userGerenteRecord?.profile_id === 'string'
      ? userGerenteRecord.profile_id.toLowerCase().trim()
      : ''
  const logGerenteEmail =
    typeof userGerenteRecord?.email === 'string' ? userGerenteRecord.email.toLowerCase().trim() : ''
  const logGerenteNome =
    typeof userGerenteRecord?.nome === 'string' ? userGerenteRecord.nome.toLowerCase().trim() : ''
  const logGerenteUsuario =
    typeof userGerenteRecord?.usuario === 'string'
      ? userGerenteRecord.usuario.toLowerCase().trim()
      : ''

  // A. Comparação por ID de Gerente
  if (associatedGerenteId) {
    const assocIdLower = associatedGerenteId.toLowerCase().trim()

    // O id associado bate com o id do registro de gerente do usuário logado
    if (logGerenteId && assocIdLower === logGerenteId) return true

    // O id associado bate com o gerente_id do profile do usuário logado
    if (userGIdFromProfile && assocIdLower === userGIdFromProfile) return true

    // O id associado bate com o próprio user.id (caso de id unificado)
    if (userId && assocIdLower === userId) return true

    // Se temos o objeto do gerente associado, checar profile_id, email, usuario e nome dele
    if (associatedGerenteObj) {
      const assocProfileId =
        typeof associatedGerenteObj.profile_id === 'string'
          ? associatedGerenteObj.profile_id.toLowerCase().trim()
          : ''
      const assocEmail =
        typeof associatedGerenteObj.email === 'string'
          ? associatedGerenteObj.email.toLowerCase().trim()
          : ''
      const assocUsuario =
        typeof associatedGerenteObj.usuario === 'string'
          ? associatedGerenteObj.usuario.toLowerCase().trim()
          : ''
      const assocNome =
        typeof associatedGerenteObj.nome === 'string'
          ? associatedGerenteObj.nome.toLowerCase().trim()
          : ''

      if (assocProfileId && userId && assocProfileId === userId) {
        return true
      }
      if (logGerenteProfileId && assocProfileId && assocProfileId === logGerenteProfileId) {
        return true
      }
      if (assocEmail && userEmail && assocEmail === userEmail) {
        return true
      }
      if (assocUsuario && userEmail && assocUsuario === userEmail) {
        return true
      }
      if (logGerenteEmail && assocEmail && assocEmail === logGerenteEmail) {
        return true
      }
      if (assocNome && userNome && assocNome === userNome) {
        return true
      }
      if (assocNome && logGerenteNome && assocNome === logGerenteNome) {
        return true
      }
    }
  }

  // B. Comparação por email se disponível no objeto associado
  if (associatedGerenteObj?.email && typeof associatedGerenteObj.email === 'string') {
    const assocEmail = associatedGerenteObj.email.toLowerCase().trim()
    if (userEmail && assocEmail === userEmail) return true
    if (logGerenteEmail && assocEmail === logGerenteEmail) return true
  }

  // C. Comparação por nome selecionado/gravado
  if (effectiveNomeGerente) {
    const sNome = effectiveNomeGerente.toLowerCase().trim()
    if (userNome && sNome === userNome) return true
    if (logGerenteNome && sNome === logGerenteNome) return true
  }

  return false
}
