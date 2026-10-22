import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { SignaturePad } from '@/components/propostas/SignaturePad'
import { uploadSignature, updateProposta } from '@/services/propostas'
import { toast } from '@/hooks/use-toast'
import { Loader2, CheckCircle2, Lock, UserCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { PropostaWithRelations } from '@/types/proposta'
import { formatDateTime } from '@/lib/format'
import { canDrawGerenteSignature } from '@/lib/gerente-signature-auth'
import { findGerenteByProfile } from '@/services/gerentes'
import { Gerente } from '@/types/gerente'

interface Props {
  proposta: PropostaWithRelations
  userName?: string
  onUpdated?: () => void
}

export function SignatureSection({ proposta, userName, onUpdated }: Props) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [currentUserGerenteId, setCurrentUserGerenteId] = useState<string | null>(null)
  const [userRepresentanteId, setUserRepresentanteId] = useState<string | null>(null)
  const [userGerenteRecord, setUserGerenteRecord] = useState<Gerente | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [uploading, setUploading] = useState<'representante' | 'gerente' | null>(null)

  // Local state for proposal signatures to update immediately on sign
  const [propostaState, setPropostaState] = useState<PropostaWithRelations>(proposta)
  const [signerNames, setSignerNames] = useState<{
    representanteName: string
    gerenteName: string
    assinadoPorRepName?: string
    assinadoPorGerName?: string
  }>({
    representanteName: 'o representante vinculado',
    gerenteName: 'o gerente vinculado',
  })

  useEffect(() => {
    setPropostaState(proposta)
  }, [proposta])

  // Get current logged-in user ID, profile role and linked representative
  useEffect(() => {
    let isMounted = true
    async function loadAuthInfo() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          if (isMounted) setLoadingAuth(false)
          return
        }

        const uId = user.id
        const uEmail = user.email || ''

        let rRole: string | null = null
        let pGerenteId: string | null = null
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, gerente_id')
            .eq('id', uId)
            .maybeSingle()
          if (profile) {
            rRole = profile.role
            pGerenteId = profile.gerente_id || null
          }
        } catch {
          // Keep null
        }

        // Check if user is linked to any representative by email in representantes table
        let repIdMatch: string | null = null
        try {
          const { data: reps } = await supabase.from('representantes').select('id, emails')
          if (reps && uEmail) {
            const lowerEmail = uEmail.toLowerCase()
            const found = (reps as { id: string; emails?: string[] | null }[]).find(
              (r) =>
                Array.isArray(r.emails) &&
                r.emails.some((e) => typeof e === 'string' && e.toLowerCase() === lowerEmail),
            )
            if (found) {
              repIdMatch = found.id
            }
          }
        } catch {
          // Rep match error
        }

        // Resolver o registro de gerente do usuário caso ele seja gerente
        let resolvedGerente: Gerente | null = null
        try {
          resolvedGerente = await findGerenteByProfile(uId, uEmail, pGerenteId)
        } catch {
          // Keep null
        }

        if (isMounted) {
          setCurrentUserId(uId)
          setCurrentUserEmail(uEmail)
          setUserRole(rRole)
          setCurrentUserGerenteId(pGerenteId)
          setUserGerenteRecord(resolvedGerente)
          setUserRepresentanteId(repIdMatch)
          setLoadingAuth(false)
        }
      } catch {
        if (isMounted) setLoadingAuth(false)
      }
    }

    loadAuthInfo()

    return () => {
      isMounted = false
    }
  }, [])

  // Resolve display names for assignees and effective signers
  useEffect(() => {
    let isMounted = true

    async function resolveNames() {
      const repId = propostaState.assinante_representante_id || propostaState.representante
      const gerId = propostaState.assinante_gerente_id || propostaState.gerente
      const assPorRepId = propostaState.assinado_por_representante
      const assPorGerId = propostaState.assinado_por_gerente

      let repName =
        propostaState.assinante_representante?.fantasia ||
        propostaState.representantes?.fantasia ||
        propostaState.nome_representante_comercial ||
        propostaState.representante_original ||
        'o representante vinculado'

      let gerName =
        propostaState.assinante_gerente?.nome ||
        propostaState.gerentes?.nome ||
        propostaState.nome_gerente_produto ||
        propostaState.gerente_original ||
        'o gerente vinculado'

      let assPorRepName: string | undefined
      let assPorGerName: string | undefined

      const idsToFetch = [repId, gerId, assPorRepId, assPorGerId].filter((id): id is string => !!id)

      if (idsToFetch.length > 0) {
        try {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, email')
            .in('id', idsToFetch)

          if (profiles && profiles.length > 0) {
            const profileMap = new Map(profiles.map((p) => [p.id, p.name || p.email || 'Usuário']))

            if (repId && profileMap.has(repId)) {
              repName = profileMap.get(repId)!
            }
            if (gerId && profileMap.has(gerId)) {
              gerName = profileMap.get(gerId)!
            }
            if (assPorRepId && profileMap.has(assPorRepId)) {
              assPorRepName = profileMap.get(assPorRepId)
            }
            if (assPorGerId && profileMap.has(assPorGerId)) {
              assPorGerName = profileMap.get(assPorGerId)
            }
          }
        } catch {
          // Keep default names if resolution fails
        }
      }

      if (isMounted) {
        setSignerNames({
          representanteName: repName,
          gerenteName: gerName,
          assinadoPorRepName: assPorRepName,
          assinadoPorGerName: assPorGerName,
        })
      }
    }

    resolveNames()

    return () => {
      isMounted = false
    }
  }, [propostaState])

  const repAssigneeId = propostaState.assinante_representante_id || propostaState.representante
  const gerAssigneeId = propostaState.assinante_gerente_id || propostaState.gerente

  const isAdmin = userRole === 'Admin Completo' || userRole === 'admin'

  // User is authorized for representative signature if:
  // 1. User is an Admin
  // 2. User ID matches the assignee ID
  // 3. User's linked representative ID matches the proposal's representative ID
  const isRepSigner = !!(
    isAdmin ||
    (currentUserId &&
      repAssigneeId &&
      currentUserId.toLowerCase() === repAssigneeId.toLowerCase()) ||
    (userRepresentanteId &&
      repAssigneeId &&
      userRepresentanteId.toLowerCase() === repAssigneeId.toLowerCase())
  )

  // Regra centralizada e estrita de assinatura do gerente:
  // Somente o usuário logado com papel de Gerente QUE SEJA O GERENTE ASSOCIADO a esta proposta
  // pode cadastrar/desenhar a assinatura. Se for admin que não é o gerente associado, representante,
  // vendedor ou outro gerente: NUNCA pode assinar (isGerSigner = false).
  const isGerSigner = canDrawGerenteSignature({
    user: {
      id: currentUserId || undefined,
      email: currentUserEmail || undefined,
      role: userRole || undefined,
      name: userName,
      gerente_id: currentUserGerenteId,
    },
    userGerenteRecord,
    proposta: propostaState,
  })

  const repSigned = !!propostaState.assinatura_representante
  const gerSigned = !!propostaState.assinatura_gerente_produto

  // Regra do produto: o bloco de assinatura desenhada do GERENTE só pode aparecer e funcionar
  // para o usuário que é o GERENTE ASSOCIADO àquela proposta específica.
  // Assinaturas já gravadas continuam sendo exibidas normalmente no documento/PDF para todos.
  // Se ainda NÃO está assinada, o bloco NÃO deve aparecer para quem não for o gerente associado.
  const canViewGerenteSignatureBlock = gerSigned || isGerSigner

  const handleSaveSignature = async (role: 'representante' | 'gerente', blob: Blob) => {
    if (!currentUserId) {
      toast({
        title: 'Usuário não autenticado',
        description: 'Você precisa estar logado para assinar.',
        variant: 'destructive',
      })
      return
    }

    if (role === 'gerente' && !isGerSigner) {
      toast({
        title: 'Permissão negada',
        description: 'Somente o gerente associado a esta proposta pode cadastrar a assinatura.',
        variant: 'destructive',
      })
      return
    }

    setUploading(role)
    try {
      const nowIso = new Date().toISOString()
      const url = await uploadSignature(blob, `assinatura-${role}`)

      const updatePayload: Record<string, unknown> =
        role === 'representante'
          ? {
              assinatura_representante: url,
              assinado_por_representante: currentUserId,
              data_assinatura_representante: nowIso,
            }
          : {
              assinatura_gerente_produto: url,
              assinado_por_gerente: currentUserId,
              data_assinatura_gerente: nowIso,
            }

      await updateProposta(propostaState.id, updatePayload, userName)

      setPropostaState((prev) => ({
        ...prev,
        ...updatePayload,
      }))

      toast({
        title: `Assinatura do ${role === 'representante' ? 'Representante' : 'Gerente'} salva com sucesso!`,
      })

      if (onUpdated) {
        onUpdated()
      }
    } catch (err) {
      toast({
        title: 'Erro ao salvar assinatura',
        description: err instanceof Error ? err.message : 'Falha no upload da assinatura.',
        variant: 'destructive',
      })
    } finally {
      setUploading(null)
    }
  }

  if (loadingAuth) {
    return (
      <div className="flex items-center justify-center p-8 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">
          Verificando permissões de assinatura...
        </span>
      </div>
    )
  }

  return (
    <div
      className={`grid grid-cols-1 ${canViewGerenteSignatureBlock ? 'md:grid-cols-2' : ''} gap-6`}
    >
      {/* 1. Assinatura do Representante */}
      <div className="space-y-3 p-4 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50 flex flex-col justify-between">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
              <UserCheck className="w-4 h-4 text-primary" />
              Assinatura do Representante
            </Label>
            {repSigned && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Assinado
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Vinculado:{' '}
            <span className="font-medium text-foreground">{signerNames.representanteName}</span>
          </p>
        </div>

        <div className="my-2">
          {uploading === 'representante' ? (
            <div className="flex flex-col items-center justify-center h-[160px] border rounded-lg bg-white dark:bg-slate-950">
              <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
              <span className="text-xs text-muted-foreground">Salvando assinatura...</span>
            </div>
          ) : repSigned ? (
            <div className="space-y-2">
              <div className="border rounded-lg p-3 bg-white flex items-center justify-center min-h-[120px]">
                <img
                  src={propostaState.assinatura_representante!}
                  alt="Assinatura do Representante"
                  className="max-h-[120px] object-contain"
                />
              </div>
              <div className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800/60 p-2.5 rounded border leading-tight">
                <p className="font-medium text-foreground">
                  Assinado por{' '}
                  <span className="font-semibold">
                    {signerNames.assinadoPorRepName || signerNames.representanteName}
                  </span>
                </p>
                {propostaState.data_assinatura_representante && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    em {formatDateTime(propostaState.data_assinatura_representante)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {!isRepSigner && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-semibold">
                      Apenas {signerNames.representanteName} ou Administradores podem assinar este
                      campo.
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      O seu usuário não corresponde ao representante vinculado a esta proposta.
                    </p>
                  </div>
                </div>
              )}{' '}
              <SignaturePad
                onSave={(blob) => handleSaveSignature('representante', blob)}
                label="Assinatura Representante"
                disabled={!isRepSigner}
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. Assinatura do Gerente */}
      {canViewGerenteSignatureBlock && (
        <div className="space-y-3 p-4 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                <UserCheck className="w-4 h-4 text-primary" />
                Assinatura do Gerente
              </Label>
              {gerSigned && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Assinado
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Vinculado:{' '}
              <span className="font-medium text-foreground">{signerNames.gerenteName}</span>
            </p>
          </div>

          <div className="my-2">
            {uploading === 'gerente' ? (
              <div className="flex flex-col items-center justify-center h-[160px] border rounded-lg bg-white dark:bg-slate-950">
                <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                <span className="text-xs text-muted-foreground">Salvando assinatura...</span>
              </div>
            ) : gerSigned ? (
              <div className="space-y-2">
                <div className="border rounded-lg p-3 bg-white flex items-center justify-center min-h-[120px]">
                  <img
                    src={propostaState.assinatura_gerente_produto!}
                    alt="Assinatura do Gerente"
                    className="max-h-[120px] object-contain"
                  />
                </div>
                <div className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800/60 p-2.5 rounded border leading-tight">
                  <p className="font-medium text-foreground">
                    Assinado por{' '}
                    <span className="font-semibold">
                      {signerNames.assinadoPorGerName || signerNames.gerenteName}
                    </span>
                  </p>
                  {propostaState.data_assinatura_gerente && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      em {formatDateTime(propostaState.data_assinatura_gerente)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <SignaturePad
                  onSave={(blob) => handleSaveSignature('gerente', blob)}
                  label="Assinatura Gerente"
                  disabled={!isGerSigner}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
