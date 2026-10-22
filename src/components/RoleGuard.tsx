import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Skeleton } from '@/components/ui/skeleton'

export function RoleGuard({
  children,
  requiredRole,
  disallowedRole,
  redirectTo = '/dashboard',
}: {
  children: React.ReactNode
  requiredRole?: string | string[]
  disallowedRole?: string | string[]
  redirectTo?: string
}) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex-1 p-8 space-y-6">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  const currentRole = user?.role ? user.role.toLowerCase().trim() : ''

  // Se houver papéis expressamente bloqueados (ex: Vendedor e Representante)
  if (disallowedRole) {
    const blockedRoles = (Array.isArray(disallowedRole) ? disallowedRole : [disallowedRole]).map(
      (r) => r.toLowerCase().trim(),
    )
    const isBlocked =
      (blockedRoles.includes('vendedor') && isVendedorRole(user?.role)) ||
      (blockedRoles.includes('representante') && isRepresentanteRole(user?.role)) ||
      (currentRole ? blockedRoles.includes(currentRole) : false)

    if (isBlocked) {
      return <Navigate to={redirectTo} replace />
    }
  }

  // Se houver papéis expressamente exigidos
  if (requiredRole) {
    const allowedRoles = (Array.isArray(requiredRole) ? requiredRole : [requiredRole]).map((r) =>
      r.toLowerCase().trim(),
    )
    const hasAccess = currentRole ? allowedRoles.includes(currentRole) : false

    if (!hasAccess) {
      return <Navigate to={redirectTo} replace />
    }
  }

  return <>{children}</>
}

export function isAdminRole(role: string | undefined): boolean {
  if (!role) return false
  const r = role.toLowerCase().trim()
  return r === 'admin' || r === 'admin completo' || r === 'administrador' || r.startsWith('admin')
}

export function isGerenteRole(role: string | undefined): boolean {
  if (!role) return false
  const r = role.toLowerCase().trim()
  return r === 'gerente' || r.includes('gerente')
}

export function isVendedorRole(role: string | undefined): boolean {
  if (!role) return false
  const r = role.toLowerCase().trim()
  return (
    r === 'vendedor' ||
    r === 'representante' ||
    r === 'rep' ||
    r.includes('representante') ||
    r.includes('vendedor')
  )
}

export function isRepresentanteRole(role: string | undefined): boolean {
  return isVendedorRole(role)
}
