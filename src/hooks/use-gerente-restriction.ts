import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { isRepresentanteRole, isAdminRole } from '@/components/RoleGuard'
import { findRepresentanteByProfile } from '@/services/representantes'
import { supabase } from '@/lib/supabase/client'

export interface UserGerenteRestriction {
  /** Se o usuário é vendedor ou representante comercial */
  isRestrictedRole: boolean
  /** Se possui uma restrição ativa de categoria herdada do gerente */
  hasRestriction: boolean
  /** ID da categoria permitida (null se sem restrição ou não aplicável) - retrocompatibilidade */
  categoriaId: string | null
  /** Nome da categoria permitida (null se sem restrição ou não aplicável) */
  categoriaNome: string | null
  /** IDs de todas as categorias permitidas ao usuário */
  categoriaIds: string[]
  /** ID do gerente vinculado */
  gerenteId: string | null
  /** Nome do gerente vinculado */
  gerenteNome: string | null
  /** Indicador de carregamento dos dados de restrição */
  loading: boolean
}

/**
 * Hook para obter a restrição de catálogo por gerente para o usuário atual.
 *
 * Regra:
 * Se o usuário for Vendedor ou Representante e estiver vinculado a um gerente
 * (via representantes.gerente_id ou profiles.gerente_id) que tenha
 * `categoria_restrita_id` preenchida, retorna `hasRestriction = true` e o `categoriaId`.
 *
 * Administradores e Gerentes NUNCA sofrem restrição (hasRestriction = false).
 */
export function useGerenteCategoryRestriction(): UserGerenteRestriction {
  const { user } = useAuth()
  const [state, setState] = useState<UserGerenteRestriction>({
    isRestrictedRole: false,
    hasRestriction: false,
    categoriaId: null,
    categoriaNome: null,
    categoriaIds: [],
    gerenteId: null,
    gerenteNome: null,
    loading: true,
  })

  useEffect(() => {
    let isMounted = true

    if (!user) {
      setState({
        isRestrictedRole: false,
        hasRestriction: false,
        categoriaId: null,
        categoriaNome: null,
        categoriaIds: [],
        gerenteId: null,
        gerenteNome: null,
        loading: false,
      })
      return
    }

    const roleNormalized = (typeof user.role === 'string' ? user.role : '').trim().toLowerCase()
    const isAdmin = isAdminRole(user.role)
    const isRep =
      !isAdmin &&
      (isRepresentanteRole(roleNormalized) ||
        roleNormalized === 'vendedor' ||
        roleNormalized === 'representante')

    // Administradores e Gerentes têm acesso total (hasRestriction = false)
    if (!isRep) {
      setState({
        isRestrictedRole: false,
        hasRestriction: false,
        categoriaId: null,
        categoriaNome: null,
        categoriaIds: [],
        gerenteId: null,
        gerenteNome: null,
        loading: false,
      })
      return
    }

    ;(async () => {
      try {
        // 1. Localizar representante vinculado ao profile/email
        const rep =
          user.id || user.email
            ? await findRepresentanteByProfile(user.id, user.email).catch((e) => {
                console.warn('Erro ao buscar representante no hook de restrição:', e)
                return null
              })
            : null
        const repId = rep?.id || null
        const resolvedGerenteId = rep?.gerente_id || user.gerente_id || null

        // 2. Buscar categorias em representante_categorias e representante_gerente_categorias
        const allowedCatSet = new Set<string>()

        if (repId) {
          try {
            const [{ data: repCats }, { data: rgcCats }] = await Promise.all([
              supabase
                .from('representante_categorias')
                .select('categoria_id')
                .eq('representante_id', repId),
              supabase
                .from('representante_gerente_categorias')
                .select('categoria_id')
                .eq('representante_id', repId),
            ])

            for (const rc of repCats || []) {
              if (rc?.categoria_id) allowedCatSet.add(rc.categoria_id)
            }
            for (const rgc of rgcCats || []) {
              if (rgc?.categoria_id) allowedCatSet.add(rgc.categoria_id)
            }
          } catch (fetchErr) {
            console.warn('Aviso ao buscar categorias do representante:', fetchErr)
          }
        }

        // 3. Fallback legado: Se não tiver categorias específicas mapeadas, mas tiver gerente com categoria_restrita_id
        let legadoCatId: string | null = null
        let gerenteNome: string | null = null

        if (resolvedGerenteId) {
          try {
            const { data: gerenteData, error: gerErr } = await supabase
              .from('gerentes')
              .select(`
                id,
                nome,
                categoria_restrita_id,
                categoria_restrita:categorias!gerentes_categoria_restrita_id_fkey (
                  id,
                  nome
                )
              `)
              .eq('id', resolvedGerenteId)
              .maybeSingle()

            if (!gerErr && gerenteData) {
              gerenteNome = gerenteData.nome || null
              const catRestritaObj = (gerenteData as any)?.categoria_restrita
              legadoCatId = gerenteData.categoria_restrita_id || catRestritaObj?.id || null
              if (legadoCatId && allowedCatSet.size === 0) {
                allowedCatSet.add(legadoCatId)
              }
            }
          } catch (gerEx) {
            console.warn('Aviso ao buscar gerente vinculado:', gerEx)
          }
        }

        const catIds = Array.from(allowedCatSet)
        const primaryCatId = catIds[0] || null

        let primaryCatNome: string | null = null
        if (primaryCatId) {
          try {
            const { data: catData } = await supabase
              .from('categorias')
              .select('nome')
              .eq('id', primaryCatId)
              .maybeSingle()
            primaryCatNome = catData?.nome || null
          } catch (catEx) {
            console.warn('Aviso ao buscar nome da categoria:', catEx)
          }
        }

        if (isMounted) {
          setState({
            isRestrictedRole: true,
            // Restrito caso seja papel comercial (representante/vendedor)
            hasRestriction: catIds.length > 0 || !!legadoCatId,
            categoriaId: primaryCatId,
            categoriaNome: primaryCatNome,
            categoriaIds: catIds,
            gerenteId: resolvedGerenteId,
            gerenteNome,
            loading: false,
          })
        }
      } catch (err) {
        console.error('Erro ao resolver restrição de catálogo por gerente/categoria:', err)
        if (isMounted) {
          setState((prev) => ({ ...prev, loading: false }))
        }
      }
    })()

    return () => {
      isMounted = false
    }
  }, [user?.id, user?.email, user?.role, user?.gerente_id])

  return state
}
