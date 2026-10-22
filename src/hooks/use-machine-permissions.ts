import { useAuth } from '@/hooks/use-auth'
import { isAdminRole, isGerenteRole, isRepresentanteRole } from '@/components/RoleGuard'

/**
 * Permission rules for the machine hierarchy (Categoria, Produto, Marca,
 * Modelo, Versão).
 *
 * Only **Admin**, **Gerente**, and users in the **Comercial** setor may
 * create/edit/delete machines.
 * Representante and Vendedor NUNCA editam ou criam máquinas.
 *
 * - "Admin" is determined by the profile role (`Admin Completo` / `admin`).
 * - "Gerente" is determined by the profile role (`Gerente` / `gerente`).
 * - "Comercial" is determined by the profile `setor` field.
 * - "Representante" / "Vendedor" are explicitly blocked even if setor is ambiguous.
 *
 * Selection/dropdowns are NEVER affected — they keep working for all roles.
 */
export function useCanEditMachines(): boolean {
  const { user } = useAuth()
  if (!user) return false
  // Representante e Vendedor NUNCA editam ou criam máquinas
  if (isRepresentanteRole(user.role)) return false
  // Admin ou Gerente explicitamente autorizados
  if (isAdminRole(user.role)) return true
  if (isGerenteRole(user.role) || user.role === 'Gerente' || user.role === 'gerente') return true
  const setor = (user.setor ?? '').trim().toLowerCase()
  return setor === 'comercial'
}

export const MACHINE_EDIT_DENIED_TOOLTIP =
  'Apenas os perfis Gerente, Comercial e Admin podem cadastrar ou editar máquinas'
