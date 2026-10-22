import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { isAdminRole, isGerenteRole, isRepresentanteRole } from '@/components/RoleGuard'

export interface RepresentanteCategoriesState {
  loading: boolean
  isRestricted: boolean // true se o usuário é representante/vendedor
  categoriaIds: string[] // lista de IDs permitidos (vazia se não for restrito OU se não tiver nenhuma)
  hasAccess: boolean // false se for restrito e lista vazia (bloqueia todas as máquinas)
  representanteId: string | null
}

export function useRepresentanteCategories(): RepresentanteCategoriesState {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [representanteId, setRepresentanteId] = useState<string | null>(null)
  const [categoriaIds, setCategoriaIds] = useState<string[]>([])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setLoading(false)
      setRepresentanteId(null)
      setCategoriaIds([])
      return
    }

    const isAdmin = isAdminRole(user.role)
    const isGerente = isGerenteRole(user.role)
    const isRep = isRepresentanteRole(user.role)

    // Admin e Gerente: acesso total sem restrição de representante
    if (isAdmin || isGerente || !isRep) {
      setLoading(false)
      setRepresentanteId(null)
      setCategoriaIds([])
      return
    }

    let isMounted = true

    async function loadRepCategories() {
      setLoading(true)
      try {
        // 1. Localizar representante por profile_id ou email
        const { data: rep } = await supabase
          .from('representantes')
          .select('id')
          .or(`profile_id.eq.${user?.id},email.ilike.${user?.email}`)
          .maybeSingle()

        if (!rep) {
          if (isMounted) {
            setRepresentanteId(null)
            setCategoriaIds([])
            setLoading(false)
          }
          return
        }

        if (isMounted) {
          setRepresentanteId(rep.id)
        }

        // 2. Buscar categorias vinculadas em representante_categorias
        const { data: cats, error } = await supabase
          .from('representante_categorias')
          .select('categoria_id')
          .eq('representante_id', rep.id)

        if (error) {
          console.error('Erro ao buscar categorias do representante:', error)
          if (isMounted) {
            setCategoriaIds([])
            setLoading(false)
          }
          return
        }

        const ids = (cats || [])
          .map((c: { categoria_id: string }) => c.categoria_id)
          .filter(Boolean)

        if (isMounted) {
          setCategoriaIds(ids)
          setLoading(false)
        }
      } catch (err) {
        console.error('Falha ao resolver categorias do representante:', err)
        if (isMounted) {
          setCategoriaIds([])
          setLoading(false)
        }
      }
    }

    loadRepCategories()

    return () => {
      isMounted = false
    }
  }, [user, authLoading])

  const isRestricted = !authLoading && !!user && isRepresentanteRole(user.role)

  return {
    loading: authLoading || loading,
    isRestricted,
    categoriaIds,
    hasAccess: !isRestricted || categoriaIds.length > 0,
    representanteId,
  }
}
