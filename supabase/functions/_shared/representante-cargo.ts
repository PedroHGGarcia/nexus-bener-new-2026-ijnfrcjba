// Ponto 25 (equivalente server-side de src/lib/representante-cargo.ts):
// Se o representante comercial escolhido for um usuário cadastrado como
// "Vendedor" (profiles.role, via representantes.profile_id), a assinatura no
// PDF exibe "Vendedor Comercial"; caso contrário, mantém o label atual.
// src/lib não é importável pelas edge functions, por isto vive em _shared.
export const VENDEDOR_COMERCIAL_CARGO = 'Vendedor Comercial'
export const REPRESENTANTE_COMERCIAL_CARGO = 'Representante Comercial'

interface RepCargoSource {
  profile_id?: string | null
  profiles?: { role?: string | null } | null
}

/** Normaliza o cargo do representante (trim/lowercase) para comparação. */
export function normalizeRepRole(role: string | null | undefined): string {
  return String(role ?? '')
    .trim()
    .toLowerCase()
}

/**
 * Resolve o cargo de assinatura a partir do registro do representante
 * (supabase embed representantes(... profiles(id, role))).
 * Sem profile/role, retorna o cargo clássico "Representante Comercial".
 */
export function resolveRepresentanteCargo(
  representante: RepCargoSource | null | undefined,
): string {
  return normalizeRepRole(representante?.profiles?.role) === 'vendedor'
    ? VENDEDOR_COMERCIAL_CARGO
    : REPRESENTANTE_COMERCIAL_CARGO
}

/**
 * Resolve o cargo a partir de um objeto proposta que embute representantes
 * (e/ou assinante_representante) com profiles(id, role).
 */
interface ProposalRepCargoSource {
  representantes?: (RepCargoSource & Record<string, unknown>) | null
  assinante_representante?: (RepCargoSource & Record<string, unknown>) | null
}

export function resolveProposalRepCargo(
  proposta: ProposalRepCargoSource | null | undefined,
): string {
  const source = proposta?.assinante_representante ?? proposta?.representantes ?? null
  return resolveRepresentanteCargo(source)
}
