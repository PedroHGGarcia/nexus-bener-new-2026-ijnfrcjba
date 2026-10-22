import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { SignaturePad } from '@/components/propostas/SignaturePad'
import { ProposalDocument } from '@/components/propostas/ProposalDocument'
import { fetchPublicProposta, validatePublicProposta } from '@/services/propostas'
import { PropostaWithRelations, STATUS_LABELS } from '@/types/proposta'
import { toast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/format'

export default function ValidarProposta() {
  const { id, token } = useParams<{ id?: string; token?: string }>()
  const identifier = token || id
  const [proposal, setProposal] = useState<PropostaWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [validating, setValidating] = useState(false)

  const loadData = useCallback(async () => {
    if (!identifier) return
    setLoading(true)
    setError(false)
    try {
      const data = await fetchPublicProposta(identifier)
      setProposal(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [identifier])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleValidate = async (blob: Blob) => {
    if (!identifier) return
    setValidating(true)
    try {
      // Convert Blob to data URL for edge function
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      const res = await validatePublicProposta(identifier, dataUrl)
      if (!res.success) {
        throw new Error(res.error || 'Erro ao validar proposta')
      }
      const data = await fetchPublicProposta(identifier)
      setProposal(data)
      toast({ title: 'Proposta validada com sucesso!' })
    } catch (err) {
      toast({
        title: 'Erro ao validar proposta',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setValidating(false)
    }
  }

  const alreadyValidated = proposal?.status === 'Validada' || !!proposal?.assinatura_cliente

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <LoadingState count={4} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-elevation">
          <CardContent className="pt-6">
            <ErrorState message="Ocorreu um erro ao carregar a proposta." onRetry={loadData} />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-elevation">
          <CardHeader className="text-center">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
            <CardTitle>Proposta não encontrada</CardTitle>
            <CardDescription>
              O código informado ({identifier || '—'}) não consta em nossa base oficial.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link
              to="/login"
              className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Ir para o Nexus Bener
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (alreadyValidated) {
    return (
      <div className="min-h-screen bg-muted/30 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg border border-primary/20 mb-4">
            <CheckCircle className="w-6 h-6 text-primary" />
            <div>
              <p className="font-bold text-primary">Proposta Validada com Sucesso!</p>
              <p className="text-xs text-muted-foreground">
                Esta proposta já foi validada e assinada pelo cliente.
              </p>
            </div>
          </div>
          <ProposalDocument proposal={proposal} />
          <div className="text-center mt-4 no-print">
            <Link
              to="/login"
              className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Ir para o Nexus Bener
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-elevation">
        <CardHeader className="text-center">
          <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground font-black text-xl flex items-center justify-center mx-auto mb-2">
            B
          </div>
          <CardTitle className="text-xl">Validação de Proposta Comercial</CardTitle>
          <CardDescription>Bener Máquinas — Verificação e Aceite Documental</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/20 space-y-2">
            <div className="flex items-center gap-2 text-primary font-bold">
              <ShieldCheck className="w-5 h-5" /> Proposta Encontrada
            </div>
            <div className="text-xs space-y-1">
              <div>
                <strong>Número:</strong> {proposal.numero_proposta}
              </div>
              <div>
                <strong>Cliente:</strong>{' '}
                {proposal.clientes?.razao_social ||
                  proposal.clientes?.fantasia ||
                  proposal.cliente_original ||
                  '—'}
              </div>
              <div>
                <strong>Equipamento:</strong>{' '}
                {proposal.versoes?.nome || proposal.versao_original || '—'}
              </div>
              <div>
                <strong>Valor Total:</strong> {formatCurrency(proposal.valor_final)}
              </div>
              <div>
                <strong>Status:</strong>{' '}
                <Badge>{STATUS_LABELS[proposal.status] || proposal.status}</Badge>
              </div>
              <div>
                <strong>Data Emissão:</strong> {proposal.dt_cad || '—'}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Assinatura do Cliente</p>
            <p className="text-xs text-muted-foreground">
              Desenhe sua assinatura abaixo para validar e aprovar esta proposta.
            </p>
            {validating ? (
              <div className="flex items-center justify-center h-[200px] border rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Validando proposta...</p>
                </div>
              </div>
            ) : (
              <SignaturePad onSave={(blob) => handleValidate(blob)} label="Assinatura" />
            )}
          </div>
          <div className="text-center pt-2">
            <Link
              to="/login"
              className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Ir para o Nexus Bener
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
