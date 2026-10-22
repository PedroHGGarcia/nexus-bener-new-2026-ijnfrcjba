import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { executeBatchCepLookup, countPendingCepClientes } from '@/services/clientes'
import {
  MapPin,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react'

interface BatchCepLookupSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleted?: () => void
}

export function BatchCepLookupSheet({ open, onOpenChange, onCompleted }: BatchCepLookupSheetProps) {
  const [initialPending, setInitialPending] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalProcessed, setTotalProcessed] = useState(0)
  const [totalUpdated, setTotalUpdated] = useState(0)
  const [totalSkipped, setTotalSkipped] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [isDone, setIsDone] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const stopRequestedRef = useRef(false)

  const loadPendingCount = useCallback(async () => {
    setLoadingCount(true)
    try {
      const count = await countPendingCepClientes()
      setInitialPending(count)
      setRemaining(count)
    } catch {
      setInitialPending(0)
      setRemaining(0)
    } finally {
      setLoadingCount(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      // Reset status when opened unless already running
      if (!isRunning) {
        setIsDone(false)
        setCurrentBatch(0)
        setTotalProcessed(0)
        setTotalUpdated(0)
        setTotalSkipped(0)
        setLastError(null)
        stopRequestedRef.current = false
        loadPendingCount()
      }
    }
  }, [open, isRunning, loadPendingCount])

  const handleStart = async () => {
    setIsRunning(true)
    setIsDone(false)
    setLastError(null)
    stopRequestedRef.current = false

    let batchNumber = 0
    let processedAccum = 0
    let updatedAccum = 0
    let skippedAccum = 0
    const limit = 50

    try {
      while (!stopRequestedRef.current) {
        batchNumber++
        setCurrentBatch(batchNumber)

        try {
          const result = await executeBatchCepLookup(limit)

          processedAccum += result.processed
          updatedAccum += result.updated
          skippedAccum += result.skipped

          setTotalProcessed(processedAccum)
          setTotalUpdated(updatedAccum)
          setTotalSkipped(skippedAccum)
          setRemaining(result.remaining)

          // Condição de parada principal: quando processed === 0 (ou remaining === 0)
          if (result.processed === 0 || result.remaining === 0) {
            setIsDone(true)
            toast({
              title: 'Processamento concluído!',
              description: `Endereços atualizados: ${updatedAccum}. Ignorados/não encontrados: ${skippedAccum}.`,
            })
            if (onCompleted) onCompleted()
            break
          }
        } catch (err: any) {
          console.error(`Erro no lote ${batchNumber}:`, err)
          setLastError(err.message || 'Erro ao processar lote')
          toast({
            title: `Erro no lote ${batchNumber}`,
            description: err.message || 'Falha temporária no lote.',
            variant: 'destructive',
          })
          // Se houver erro de rede/função no lote, interrompe para não entrar em loop de falhas
          break
        }

        // Se o usuário pediu para parar
        if (stopRequestedRef.current) {
          toast({
            title: 'Processamento interrompido',
            description: `Pausado pelo usuário. Processados: ${processedAccum}`,
          })
          break
        }
      }
    } finally {
      setIsRunning(false)
      if (onCompleted) {
        onCompleted()
      }
    }
  }

  const handleStop = () => {
    stopRequestedRef.current = true
  }

  // Progresso em porcentagem
  const totalTarget = initialPending && initialPending > 0 ? initialPending : 1
  const progressPercent = isDone
    ? 100
    : Math.min(100, Math.round((totalProcessed / totalTarget) * 100))

  return (
    <Sheet open={open} onOpenChange={(val) => !isRunning && onOpenChange(val)}>
      <SheetContent side="right" className="sm:max-w-md flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0 text-left bg-card">
          <SheetTitle className="text-lg font-bold flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            Busca de CEP em Lote
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground mt-1">
            Preenche automaticamente logradouro, bairro, cidade e estado dos clientes que têm CEP
            mas estão sem logradouro válido.
          </SheetDescription>
        </SheetHeader>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* Status Inicial / Resumo */}
          <div className="bg-accent/40 border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4" /> Clientes pendentes:
              </span>
              {loadingCount ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <Badge variant="secondary" className="font-bold">
                  {remaining !== null ? remaining.toLocaleString('pt-BR') : '...'}
                </Badge>
              )}
            </div>

            {initialPending !== null && initialPending > 0 && !isRunning && !isDone && (
              <p className="text-xs text-muted-foreground">
                O processo consultará o ViaCEP em lotes de 50 registros por vez, respeitando o
                intervalo de 150ms entre requisições.
              </p>
            )}

            {isDone && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs flex items-start gap-2 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold">Endereços atualizados com sucesso!</p>
                  <p className="mt-0.5">
                    {totalUpdated} atualizados, {totalSkipped} ignorados/não encontrados.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Barra de Progresso e Métricas */}
          {(isRunning || totalProcessed > 0 || isDone) && (
            <div className="space-y-4 border rounded-lg p-4 bg-card">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium flex items-center gap-1.5">
                  {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                  {isRunning
                    ? `Processando lote ${currentBatch}...`
                    : isDone
                      ? 'Finalizado'
                      : 'Pausado'}
                </span>
                <span className="font-bold text-muted-foreground">{progressPercent}%</span>
              </div>

              <Progress value={progressPercent} className="h-2" />

              <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                <div className="bg-muted/50 rounded-md p-2">
                  <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">
                    Processados
                  </span>
                  <span className="font-bold text-sm">{totalProcessed}</span>
                </div>
                <div className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-md p-2">
                  <span className="block text-[10px] uppercase tracking-wider">Atualizados</span>
                  <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                    {totalUpdated}
                  </span>
                </div>
                <div className="bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded-md p-2">
                  <span className="block text-[10px] uppercase tracking-wider">Ignorados</span>
                  <span className="font-bold text-sm text-amber-600 dark:text-amber-400">
                    {totalSkipped}
                  </span>
                </div>
              </div>

              {lastError && (
                <div className="text-xs text-destructive flex items-center gap-1.5 pt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{lastError}</span>
                </div>
              )}
            </div>
          )}

          {/* Dicas / Info */}
          <div className="text-xs text-muted-foreground space-y-2 border-l-2 border-primary/30 pl-3">
            <p className="flex items-center gap-1 font-medium text-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Como funciona o processamento?
            </p>
            <p>
              • Os clientes que possuem apenas números no logradouro serão identificados
              automaticamente.
            </p>
            <p>• O sistema busca no ViaCEP e preenche nome de rua, bairro, cidade e UF oficiais.</p>
            <p>
              • Você pode pausar a qualquer momento e retomar depois; o progresso não é perdido.
            </p>
          </div>
        </div>

        <SheetFooter className="p-4 border-t bg-card flex flex-row items-center justify-between gap-2 shrink-0">
          {!isRunning ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={loadPendingCount}
                disabled={loadingCount}
                className="gap-1.5"
                title="Recarregar contagem"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCount ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  {isDone ? 'Concluir' : 'Fechar'}
                </Button>
                <Button
                  size="sm"
                  onClick={handleStart}
                  disabled={loadingCount || (remaining === 0 && !isDone)}
                  className="bg-primary gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {totalProcessed > 0 && !isDone ? 'Continuar' : 'Iniciar Processamento'}
                </Button>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                Lote {currentBatch} em andamento...
              </span>
              <Button variant="destructive" size="sm" onClick={handleStop} className="gap-1.5">
                <Square className="w-3.5 h-3.5 fill-current" /> Parar
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
