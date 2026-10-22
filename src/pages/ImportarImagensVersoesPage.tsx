import { useState, useRef, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import {
  loadVersoesForMatching,
  parseImageFilename,
  matchImageToVersao,
  resolveMultiFileCollisions,
  uploadAndLinkVersaoImage,
  type ImageMatchResult,
  type VersaoImageImportReport,
  type VersoesCatalogIndex,
  type VersaoLookupItem,
} from '@/services/versao-imagens'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  UploadCloud,
  FileImage,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Sparkles,
  Link2,
  ArrowLeft,
  Info,
  Trash2,
  Eye,
  SlidersHorizontal,
  HelpCircle,
  Camera,
  Check,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp']

export default function ImportarImagensVersoesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [catalogIndex, setCatalogIndex] = useState<VersoesCatalogIndex | null>(null)
  const [loadingCatalog, setLoadingCatalog] = useState(true)

  const [dragOver, setDragOver] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [items, setItems] = useState<ImageMatchResult[]>([])
  const [report, setReport] = useState<VersaoImageImportReport | null>(null)
  const [activeTab, setActiveTab] = useState<
    'todos' | 'pronto' | 'sem_match' | 'ambiguo' | 'concluido'
  >('todos')

  // Pagination state (default: 25 items per page)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Map of active object URLs for preview to avoid re-creating URL.createObjectURL on every render
  const [previewUrls, setPreviewUrls] = useState<Map<File, string>>(new Map())

  // Manual Resolution Dialog state
  const [resolvingItemIndex, setResolvingItemIndex] = useState<number | null>(null)
  const [manualSearchQuery, setManualSearchQuery] = useState('')

  // Bulk Accept Dialog state
  const [confirmBulkDialogOpen, setConfirmBulkDialogOpen] = useState(false)

  // Progress state
  const [progressPct, setProgressPct] = useState(0)
  const [progressCurrent, setProgressCurrent] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')

  // Initial load of catalog versions
  useEffect(() => {
    let isMounted = true
    const initCatalog = async () => {
      setLoadingCatalog(true)
      try {
        const index = await loadVersoesForMatching()
        if (isMounted) {
          setCatalogIndex(index)
        }
      } catch (err: any) {
        toast({
          title: 'Erro ao carregar catálogo de versões',
          description: err?.message || 'Falha na conexão com o banco de dados.',
          variant: 'destructive',
        })
      } finally {
        if (isMounted) setLoadingCatalog(false)
      }
    }
    initCatalog()
    return () => {
      isMounted = false
    }
  }, [toast])

  // Count pending versions without image by brand
  const pendingBreakdown = useMemo(() => {
    if (!catalogIndex) return { makino: 18, hyundai: 4, veker: 2, outras: 5, total: 29 }
    const list = catalogIndex.pendingWithoutImage
    let makino = 0
    let hyundai = 0
    let veker = 0
    let outras = 0

    for (const v of list) {
      const b = (v.marca_nome || '').toUpperCase()
      if (b.includes('MAKINO')) makino++
      else if (b.includes('HYUNDAI')) hyundai++
      else if (b.includes('VEKER')) veker++
      else outras++
    }

    return {
      makino,
      hyundai,
      veker,
      outras,
      total: list.length,
    }
  }, [catalogIndex])

  // Process selected or dropped image files
  const processFiles = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList)
    if (rawFiles.length === 0) return

    // Filter by allowed image extensions
    const validFiles = rawFiles.filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() || ''
      return ALLOWED_EXTENSIONS.includes(ext) || f.type.startsWith('image/')
    })

    if (validFiles.length === 0) {
      toast({
        title: 'Nenhuma imagem válida selecionada',
        description: 'Selecione fotos em formato PNG, JPG, JPEG ou WEBP.',
        variant: 'destructive',
      })
      return
    }

    setAnalyzing(true)
    setReport(null)

    try {
      let index = catalogIndex
      if (!index) {
        index = await loadVersoesForMatching()
        setCatalogIndex(index)
      }

      const rawResults: ImageMatchResult[] = validFiles.map((file) => {
        const parsed = parseImageFilename(file.name)
        return matchImageToVersao(file, parsed, index!)
      })

      // Resolve multi-file collision (strictly avoid assigning two different files to the same version)
      const resolvedResults = resolveMultiFileCollisions(rawResults)

      setItems(resolvedResults)
      toast({
        title: `${validFiles.length} imagem(ns) carregada(s)!`,
        description:
          'Verifique a prévia abaixo e clique no botão verde para enviar e vincular ao catálogo.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao analisar imagens',
        description: err instanceof Error ? err.message : 'Falha desconhecida',
        variant: 'destructive',
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  const handleReset = () => {
    // Revoke old object URLs
    previewUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // ignore
      }
    })
    setPreviewUrls(new Map())
    setItems([])
    setReport(null)
    setPage(1)
    setProgressPct(0)
    setProgressCurrent(0)
    setProgressTotal(0)
    setProgressMessage('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveItem = (index: number) => {
    const itemToRemove = items[index]
    if (itemToRemove) {
      const existingUrl = previewUrls.get(itemToRemove.file)
      if (existingUrl) {
        try {
          URL.revokeObjectURL(existingUrl)
        } catch {
          // ignore
        }
        setPreviewUrls((prev) => {
          const next = new Map(prev)
          next.delete(itemToRemove.file)
          return next
        })
      }
    }
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Manual version selection for ambiguous / no match files
  const handleOpenManualSelect = (index: number) => {
    setResolvingItemIndex(index)
    setManualSearchQuery('')
  }

  const handleAssignManualVersao = (versao: VersaoLookupItem) => {
    if (resolvingItemIndex === null) return

    setItems((prev) => {
      const next = [...prev]
      const target = next[resolvingItemIndex]
      if (target) {
        next[resolvingItemIndex] = {
          ...target,
          matchedVersao: versao,
          matchType: 'nome',
          matchReason: `Vínculo manual definido pelo usuário: "${versao.nome}"`,
          isAmbiguous: false,
          isManualOverride: true,
          status: 'pronto',
        }
      }
      return resolveMultiFileCollisions(next)
    })

    setResolvingItemIndex(null)
    toast({
      title: 'Versão vinculada com sucesso!',
      description: `Imagem associada à versão "${versao.nome}".`,
    })
  }

  // Accept top candidate for a single ambiguous item
  const handleAcceptSingleSuggestion = (itemIndex: number) => {
    const target = items[itemIndex]
    if (!target || !target.candidates || target.candidates.length === 0) {
      toast({
        title: 'Nenhuma sugestão disponível',
        description: 'Este item não possui versões candidatas sugeridas.',
        variant: 'destructive',
      })
      return
    }

    const topCandidate = target.candidates[0]

    // Check if this version is already taken by another item that is ready / manual override
    const versionAlreadyUsedByOther = items.some(
      (other, idx) =>
        idx !== itemIndex &&
        other.matchedVersao &&
        other.matchedVersao.id === topCandidate.versao.id,
    )

    if (versionAlreadyUsedByOther) {
      toast({
        title: 'Conflito de versão detectado',
        description: `A versão "${topCandidate.versao.nome}" já está vinculada a outro arquivo. Escolha outra opção manualmente.`,
        variant: 'destructive',
      })
      return
    }

    setItems((prev) => {
      const next = [...prev]
      const current = next[itemIndex]
      if (current) {
        next[itemIndex] = {
          ...current,
          matchedVersao: topCandidate.versao,
          matchType: topCandidate.matchType,
          matchReason: `Sugestão aceita: ${topCandidate.reason}`,
          isAmbiguous: false,
          isManualOverride: true, // Mark so user explicitly validated
          status: 'pronto',
        }
      }
      return resolveMultiFileCollisions(next)
    })

    toast({
      title: 'Sugestão aceita!',
      description: `"${target.file.name}" vinculada a "${topCandidate.versao.nome}". Promovida para a aba Prontos.`,
    })
  }

  // Simulation of bulk accept for dialog preview and execution
  const bulkAcceptSimulation = useMemo(() => {
    // Current locked version IDs already in use by ready/success/manual items
    const lockedVersionIds = new Set<string>()
    for (const item of items) {
      if (item.matchedVersao && (!item.isAmbiguous || item.isManualOverride)) {
        lockedVersionIds.add(item.matchedVersao.id)
      }
    }

    // Version IDs claimed during this bulk resolution
    const claimedInBulk = new Map<string, number>() // versaoId -> fileIndex
    // Also track duplicate candidate suggestions across the ambiguous items to detect collisions
    const candidateVersionUsage = new Map<string, number[]>() // versaoId -> itemIndices

    const ambiguousIndices: number[] = []
    items.forEach((item, idx) => {
      if (item.isAmbiguous && item.candidates && item.candidates.length > 0) {
        ambiguousIndices.push(idx)
        const topCandidate = item.candidates[0]
        const vId = topCandidate.versao.id
        const list = candidateVersionUsage.get(vId) || []
        list.push(idx)
        candidateVersionUsage.set(vId, list)
      }
    })

    const itemsToPromote: Array<{
      itemIndex: number
      file: File
      versao: VersaoLookupItem
      candidate: (typeof items)[0]['candidates'][0]
    }> = []

    const itemsRemainingAmbiguous: Array<{
      itemIndex: number
      file: File
      reason: string
    }> = []

    for (const idx of ambiguousIndices) {
      const item = items[idx]
      const topCandidate = item.candidates[0]
      const vId = topCandidate.versao.id

      // Rule 1: Cannot take a version that is already used by an existing ready item
      if (lockedVersionIds.has(vId)) {
        itemsRemainingAmbiguous.push({
          itemIndex: idx,
          file: item.file,
          reason: `A versão "${topCandidate.versao.nome}" já está em uso por outro arquivo pronto.`,
        })
        continue
      }

      // Rule 2: If multiple ambiguous items have the same top candidate, they conflict!
      const competingIndices = candidateVersionUsage.get(vId) || []
      if (competingIndices.length > 1) {
        itemsRemainingAmbiguous.push({
          itemIndex: idx,
          file: item.file,
          reason: `Conflito: ${competingIndices.length} arquivos sugerem a mesma versão "${topCandidate.versao.nome}". Decisão manual necessária.`,
        })
        continue
      }

      itemsToPromote.push({
        itemIndex: idx,
        file: item.file,
        versao: topCandidate.versao,
        candidate: topCandidate,
      })
    }

    return {
      totalAmbiguous: items.filter((i) => i.isAmbiguous).length,
      itemsToPromote,
      itemsRemainingAmbiguous,
    }
  }, [items])

  // Execute bulk acceptance of suggestions
  const handleConfirmBulkAccept = () => {
    const { itemsToPromote, itemsRemainingAmbiguous } = bulkAcceptSimulation
    if (itemsToPromote.length === 0) {
      toast({
        title: 'Nenhuma sugestão pôde ser aceita automaticamente',
        description:
          'Todos os itens ambíguos possuem conflitos ou disputas pela mesma versão. Resolva-os manualmente.',
        variant: 'destructive',
      })
      setConfirmBulkDialogOpen(false)
      return
    }

    const promoteMap = new Map<number, (typeof bulkAcceptSimulation.itemsToPromote)[0]>()
    for (const p of itemsToPromote) {
      promoteMap.set(p.itemIndex, p)
    }

    setItems((prev) => {
      const next = [...prev]
      for (const [idx, promo] of promoteMap.entries()) {
        const current = next[idx]
        if (current) {
          next[idx] = {
            ...current,
            matchedVersao: promo.versao,
            matchType: promo.candidate.matchType,
            matchReason: `Sugestão aceita em massa: ${promo.candidate.reason}`,
            isAmbiguous: false,
            isManualOverride: true,
            status: 'pronto',
          }
        }
      }
      return resolveMultiFileCollisions(next)
    })

    setConfirmBulkDialogOpen(false)
    setPage(1) // Return to page 1 as per requirement 5

    toast({
      title: 'Sugestões aceitas com sucesso!',
      description: `${itemsToPromote.length} imagens vinculadas automaticamente, ${itemsRemainingAmbiguous.length} continuam aguardando sua decisão.`,
    })
  }

  // Filter versions for manual search dialog
  const manualFilteredVersoes = useMemo(() => {
    if (!catalogIndex) return []
    const q = manualSearchQuery.trim().toLowerCase()
    if (!q) {
      // Prioritize pending versions without image
      return catalogIndex.pendingWithoutImage.slice(0, 50)
    }
    return catalogIndex.all
      .filter((v) => {
        const matchName = v.normNome.includes(q)
        const matchCod = v.cod_erp && v.cod_erp.toLowerCase().includes(q)
        const matchReg = v.reg && v.reg.toLowerCase().includes(q)
        const matchAbbr = v.nome_abreviado && v.nome_abreviado.toLowerCase().includes(q)
        return matchName || matchCod || matchReg || matchAbbr
      })
      .slice(0, 50)
  }, [catalogIndex, manualSearchQuery])

  // Start execution of upload and linking
  const handleExecuteImport = async () => {
    const readyItems = items.filter((item) => item.matchedVersao && item.status !== 'sucesso')
    if (readyItems.length === 0) {
      toast({
        title: 'Nenhuma imagem pronta para envio',
        description: 'Vincule as versões necessárias antes de iniciar o envio.',
        variant: 'destructive',
      })
      return
    }

    setImporting(true)
    const totalToProcess = readyItems.length
    setProgressTotal(totalToProcess)
    setProgressCurrent(0)
    setProgressPct(0)

    let totalEnviados = 0
    let totalErros = 0
    let associadosPorCodErp = 0
    let associadosPorReg = 0
    let associadosPorNome = 0
    let associadosPorAbreviado = 0

    const updatedItems = [...items]

    for (let i = 0; i < totalToProcess; i++) {
      const target = readyItems[i]
      const itemIndex = updatedItems.findIndex((it) => it.file === target.file)

      setProgressCurrent(i + 1)
      setProgressPct(Math.round(((i + 1) / totalToProcess) * 100))
      setProgressMessage(
        `Enviando ${i + 1} de ${totalToProcess}: "${target.file.name}" para "${target.matchedVersao!.nome}"...`,
      )

      if (itemIndex !== -1) {
        updatedItems[itemIndex] = { ...updatedItems[itemIndex], status: 'uploading' }
        setItems([...updatedItems])
      }

      try {
        // NUNCA apaga foto existente de versão que já tem foto (função cuida disso com segurança)
        const { url } = await uploadAndLinkVersaoImage(target.file, target.matchedVersao!.id)

        totalEnviados++
        if (target.matchType === 'cod_erp') associadosPorCodErp++
        else if (target.matchType === 'reg') associadosPorReg++
        else if (target.matchType === 'nome_abreviado') associadosPorAbreviado++
        else associadosPorNome++

        if (itemIndex !== -1) {
          updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            status: 'sucesso',
            uploadedUrl: url,
          }
        }
      } catch (err: any) {
        totalErros++
        if (itemIndex !== -1) {
          updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            status: 'erro',
            errorMessage: err?.message || 'Falha no upload do arquivo para o bucket.',
          }
        }
      }

      setItems([...updatedItems])
    }

    const semCorrespondencia = updatedItems.filter(
      (it) => it.status === 'sem_match' || (it.matchType === 'nenhum' && !it.isAmbiguous),
    )
    const ambiguos = updatedItems.filter((it) => it.isAmbiguous)
    const sucessos = updatedItems.filter((it) => it.status === 'sucesso')
    const erros = updatedItems.filter((it) => it.status === 'erro')

    const finalReport: VersaoImageImportReport = {
      totalArquivos: updatedItems.length,
      totalEnviados,
      totalErros,
      associadosPorCodErp,
      associadosPorReg,
      associadosPorNome,
      associadosPorAbreviado,
      semCorrespondencia,
      ambiguos,
      sucessos,
      erros,
    }

    setReport(finalReport)
    setImporting(false)
    setActiveTab('concluido')

    // Audit log
    try {
      await supabase.from('historico_importacoes').insert({
        tipo: 'Imagens de Versões em Lote',
        arquivo: `${totalEnviados} fotos vinculadas`,
        status: totalErros === 0 ? 'Concluído com Sucesso' : 'Concluído com Erros',
        registros_importados: totalEnviados,
        registros_erro: totalErros + semCorrespondencia.length + ambiguos.length,
        usuario: user?.name || user?.email || 'Administrador',
        erros: [
          ...erros.map((e) => ({
            arquivo: e.file.name,
            erro: e.errorMessage,
          })),
          ...semCorrespondencia.map((s) => ({
            arquivo: s.file.name,
            erro: 'Versão não encontrada para o nome do arquivo',
          })),
        ],
      })
    } catch (auditErr) {
      console.warn('Erro ao salvar histórico:', auditErr)
    }

    // Refresh catalog index in background so pending counts update
    loadVersoesForMatching().then(setCatalogIndex).catch(console.warn)

    toast({
      title: 'Importação concluída com sucesso!',
      description: `${totalEnviados} imagem(ns) enviada(s) e vinculada(s) às versões correspondentes.`,
    })
  }

  // Summary counts
  const countPronto = useMemo(
    () => items.filter((i) => i.matchedVersao && i.status !== 'sucesso').length,
    [items],
  )
  const countAmbiguo = useMemo(() => items.filter((i) => i.isAmbiguous).length, [items])
  const countSemMatch = useMemo(
    () => items.filter((i) => i.status === 'sem_match' && !i.isAmbiguous).length,
    [items],
  )
  const countSucesso = useMemo(() => items.filter((i) => i.status === 'sucesso').length, [items])

  const filteredItems = useMemo(() => {
    switch (activeTab) {
      case 'pronto':
        return items.filter((i) => i.matchedVersao && i.status !== 'sucesso')
      case 'ambiguo':
        return items.filter((i) => i.isAmbiguous)
      case 'sem_match':
        return items.filter((i) => i.status === 'sem_match' && !i.isAmbiguous)
      case 'concluido':
        return items.filter((i) => i.status === 'sucesso' || i.status === 'erro')
      case 'todos':
      default:
        return items
    }
  }, [items, activeTab])

  // Reset to page 1 whenever tab changes
  useEffect(() => {
    setPage(1)
  }, [activeTab])

  // Pagination calculations
  const totalItems = filteredItems.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)

  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, safePage, pageSize])

  // Manage lazy object URLs only for visible items to prevent memory leaks with 1500+ files
  useEffect(() => {
    const currentFiles = new Set(pagedItems.map((it) => it.file))
    setPreviewUrls((prev) => {
      const next = new Map(prev)
      let changed = false

      // Create preview for visible paged items
      for (const item of pagedItems) {
        if (!item.uploadedUrl && !next.has(item.file)) {
          next.set(item.file, URL.createObjectURL(item.file))
          changed = true
        }
      }

      // Cleanup files not on current page if map is growing too large (> 150 items)
      if (next.size > 150) {
        for (const [file, url] of next.entries()) {
          if (!currentFiles.has(file)) {
            try {
              URL.revokeObjectURL(url)
            } catch {
              // ignore
            }
            next.delete(file)
            changed = true
          }
        }
      }

      return changed ? next : prev
    })
  }, [pagedItems])

  // Cleanup all preview object URLs on component unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => {
        try {
          URL.revokeObjectURL(url)
        } catch {
          // ignore
        }
      })
    }
  }, [previewUrls])

  const targetItemBeingResolved = resolvingItemIndex !== null ? items[resolvingItemIndex] : null

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#0b3c26] text-white shadow-md">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0b3c26]">
                Importar Imagens das Versões em Lote
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Envie dezenas ou centenas de fotos de máquinas de uma só vez com associação
                automática tolerante.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Button
              variant="outline"
              size="default"
              onClick={handleReset}
              disabled={importing}
              className="gap-2 border-[#0b3c26]/30 text-[#0b3c26] hover:bg-[#0b3c26]/10 text-sm font-semibold h-10 px-4"
            >
              <RefreshCw className="w-4 h-4" /> Limpar Seleção
            </Button>
          )}
          <Button
            variant="outline"
            size="default"
            asChild
            className="gap-2 text-sm font-semibold h-10 px-4"
          >
            <Link to="/produtos/versoes">
              <ArrowLeft className="w-4 h-4" /> Voltar para Versões
            </Link>
          </Button>
        </div>
      </div>

      {/* Lembrete visível e acolhedor das 29 versões ativas sem foto */}
      <Alert className="bg-emerald-50/80 border-[#0b3c26]/30 text-[#0b3c26] shadow-sm p-4">
        <Info className="h-5 w-5 text-[#0b3c26] shrink-0 mt-0.5" />
        <div className="space-y-2">
          <AlertTitle className="font-bold text-base flex flex-wrap items-center gap-2">
            <span>Diagnóstico do Catálogo:</span>
            <Badge className="bg-[#0b3c26] text-white hover:bg-[#0b3c26] text-xs font-semibold px-2.5 py-0.5">
              {pendingBreakdown.total} versões ativas aguardando imagem
            </Badge>
          </AlertTitle>
          <AlertDescription className="text-sm text-[#0b3c26]/90 leading-relaxed">
            <p>
              Hoje o catálogo possui{' '}
              <strong>{pendingBreakdown.total} versões ativas sem foto</strong> cadastradas:{' '}
              <strong className="underline decoration-emerald-600 underline-offset-2">
                MAKINO ({pendingBreakdown.makino})
              </strong>
              ,{' '}
              <strong className="underline decoration-emerald-600 underline-offset-2">
                HYUNDAI ({pendingBreakdown.hyundai})
              </strong>
              ,{' '}
              <strong className="underline decoration-emerald-600 underline-offset-2">
                VEKER ({pendingBreakdown.veker})
              </strong>{' '}
              e outras ({pendingBreakdown.outras}).
            </p>
            <div className="mt-2 text-xs bg-white/80 p-3 rounded-lg border border-[#0b3c26]/20 font-medium text-slate-800 space-y-1">
              <p className="font-semibold text-[#0b3c26]">
                Como nomear os arquivos para casamento 100% automático:
              </p>
              <p>
                &bull; <strong>Pelo Cód. ERP ou REG:</strong> renomeie o arquivo com o número da
                versão (ex.: <code className="font-mono font-bold text-emerald-800">1460.jpg</code>,{' '}
                <code className="font-mono font-bold text-emerald-800">reg1460.png</code> ou{' '}
                <code className="font-mono font-bold text-emerald-800">reg5_NOME.png</code>).
              </p>
              <p>
                &bull; <strong>Pelo Modelo ou Nome Abreviado:</strong> ex.:{' '}
                <code className="font-mono font-bold text-emerald-800">SE2208L.png</code>,{' '}
                <code className="font-mono font-bold text-emerald-800">MAKINO_D200z.webp</code>,{' '}
                <code className="font-mono font-bold text-emerald-800">DA300.jpg</code>.
              </p>
              <p className="text-slate-600 text-[11px] pt-0.5">
                O importador é tolerante a maiúsculas/minúsculas, traços, espaços e acentos. Versões
                que já possuem foto não têm suas imagens apagadas.
              </p>
            </div>
          </AlertDescription>
        </div>
      </Alert>

      {/* Step 1: Upload Dropzone (visualmente limpa, botões grandes e fáceis de clicar) */}
      <Card className="border-dashed border-2 border-slate-300 hover:border-[#0b3c26] transition-all bg-card shadow-sm">
        <CardContent className="p-8 sm:p-10">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center p-8 sm:p-10 rounded-2xl cursor-pointer transition-all ${
              dragOver
                ? 'bg-[#0b3c26]/10 border-[#0b3c26] scale-[0.99]'
                : 'hover:bg-[#0b3c26]/5 bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".png, .jpg, .jpeg, .webp, image/png, image/jpeg, image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  processFiles(e.target.files)
                }
              }}
            />
            <div className="w-16 h-16 rounded-2xl bg-[#0b3c26] flex items-center justify-center mb-4 text-white shadow-md">
              <UploadCloud className="w-9 h-9" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 text-center">
              {items.length > 0
                ? 'Arraste ou clique para adicionar mais imagens'
                : 'Clique aqui ou arraste todas as fotos do seu computador'}
            </h2>
            <p className="text-sm text-muted-foreground mt-2 text-center max-w-xl leading-relaxed">
              Você pode selecionar <strong>dezenas ou centenas de imagens de uma única vez</strong>{' '}
              (arquivos PNG, JPG, JPEG ou WEBP).
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <Badge
                variant="outline"
                className="text-xs gap-1.5 py-1.5 px-3 bg-white font-medium border-slate-300"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" /> 1º Cód. ERP exato (ex:{' '}
                <code>1460.jpg</code>)
              </Badge>
              <Badge
                variant="outline"
                className="text-xs gap-1.5 py-1.5 px-3 bg-white font-medium border-slate-300"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" /> 2º REG exato (ex:{' '}
                <code>reg5_...</code>)
              </Badge>
              <Badge
                variant="outline"
                className="text-xs gap-1.5 py-1.5 px-3 bg-white font-medium border-slate-300"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> 3º Nome / Modelo tolerante
              </Badge>
              <Badge
                variant="outline"
                className="text-xs gap-1.5 py-1.5 px-3 bg-white font-medium border-slate-300"
              >
                <Link2 className="w-3.5 h-3.5 text-emerald-600" /> 4º Nome abreviado (ex:{' '}
                <code>SE2208L</code>)
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analyzing loader */}
      {analyzing && (
        <Card className="border shadow-sm p-8 text-center bg-emerald-50/50">
          <div className="flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-9 h-9 animate-spin text-[#0b3c26]" />
            <p className="text-base font-semibold text-[#0b3c26]">
              Cruzando arquivos com as versões do catálogo da Bener...
            </p>
          </div>
        </Card>
      )}

      {/* Step 2: Preview, Metrics and Action Bar */}
      {items.length > 0 && !analyzing && (
        <div className="space-y-6">
          {/* Summary metrics bar com números grandes e legíveis */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 text-center shadow-sm">
              <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">
                Total de Arquivos
              </span>
              <p className="text-3xl font-extrabold text-slate-900 mt-1">{items.length}</p>
            </div>

            <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-xl p-4 text-center shadow-sm">
              <span className="text-xs text-emerald-800 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Prontos p/ Vínculo
              </span>
              <p className="text-3xl font-extrabold text-emerald-800 mt-1">{countPronto}</p>
            </div>

            <div className="bg-amber-50/70 border-2 border-amber-300 rounded-xl p-4 text-center shadow-sm">
              <span className="text-xs text-amber-800 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Ambíguos
              </span>
              <p className="text-3xl font-extrabold text-amber-800 mt-1">{countAmbiguo}</p>
            </div>

            <div className="bg-slate-100 border-2 border-slate-300 rounded-xl p-4 text-center shadow-sm">
              <span className="text-xs text-slate-700 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-slate-500" /> Sem Match
              </span>
              <p className="text-3xl font-extrabold text-slate-800 mt-1">{countSemMatch}</p>
            </div>

            <div className="bg-teal-50/70 border-2 border-teal-300 rounded-xl p-4 text-center shadow-sm">
              <span className="text-xs text-teal-800 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" /> Enviados
              </span>
              <p className="text-3xl font-extrabold text-teal-800 mt-1">{countSucesso}</p>
            </div>
          </div>

          {/* Action Card: Upload Trigger with large, accessible button */}
          <Card className="shadow-sm border-2 border-[#0b3c26]/30">
            <CardHeader className="pb-4 border-b bg-slate-50/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#0b3c26]" />
                    Pronto para Salvar e Vincular
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-0.5 text-slate-600">
                    {countPronto} arquivo(s) serão enviados para o Supabase Storage e associados às
                    versões correspondentes.
                  </CardDescription>
                </div>
                <Button
                  size="lg"
                  className="bg-[#0b3c26] hover:bg-[#0b3c26]/90 text-white font-bold gap-2.5 shadow-md text-base h-12 px-6"
                  onClick={handleExecuteImport}
                  disabled={importing || countPronto === 0}
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Processando ({progressCurrent}/{progressTotal})...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-5 h-5" />
                      Confirmar e Enviar {countPronto} Imagem(ns)
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {importing && (
                <div className="space-y-3 bg-emerald-50 p-5 rounded-xl border border-[#0b3c26]/30">
                  <div className="flex justify-between items-center text-sm text-[#0b3c26] font-bold">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {progressMessage || 'Enviando imagens...'}
                    </span>
                    <span className="font-mono text-base">
                      {progressPct}% ({progressCurrent} de {progressTotal})
                    </span>
                  </div>
                  <Progress value={progressPct} className="h-3.5 bg-emerald-200" />
                </div>
              )}

              {/* Final Report Alert */}
              {report && (
                <Alert className="bg-emerald-50 border-2 border-emerald-400 text-emerald-950 p-4">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                  <AlertTitle className="font-bold text-base">
                    Relatório da Importação Concluída
                  </AlertTitle>
                  <AlertDescription className="text-sm mt-2 space-y-2 leading-relaxed">
                    <p>
                      <strong>{report.totalEnviados}</strong> imagens foram salvas no Storage e
                      vinculadas com sucesso às versões cadastradas.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                      <div className="bg-white/80 p-2 rounded border border-emerald-300">
                        Cód. ERP: <strong>{report.associadosPorCodErp}</strong>
                      </div>
                      <div className="bg-white/80 p-2 rounded border border-emerald-300">
                        REG: <strong>{report.associadosPorReg}</strong>
                      </div>
                      <div className="bg-white/80 p-2 rounded border border-emerald-300">
                        Nome abreviado: <strong>{report.associadosPorAbreviado}</strong>
                      </div>
                      <div className="bg-white/80 p-2 rounded border border-emerald-300">
                        Nome completo: <strong>{report.associadosPorNome}</strong>
                      </div>
                    </div>
                    {report.totalErros > 0 && (
                      <p className="text-rose-700 font-semibold">
                        {report.totalErros} arquivo(s) tiveram erro durante o envio.
                      </p>
                    )}
                    {report.semCorrespondencia.length > 0 && (
                      <div className="bg-amber-100/70 p-3 rounded-lg border border-amber-300 text-amber-900 text-xs mt-2 space-y-2">
                        <div>
                          <p className="font-bold">
                            {report.semCorrespondencia.length} arquivo(s) não foram casados
                            automaticamente:
                          </p>
                          <p className="mt-1">
                            Recomendação: renomeie esses arquivos usando o Cód. ERP da versão (ex.:{' '}
                            <code>&quot;1460.jpg&quot;</code> para a versão de Cód. ERP 1460) ou
                            clique no botão &quot;Escolher Versão&quot; na tabela abaixo para
                            vincular manualmente.
                          </p>
                        </div>
                        <div className="max-h-36 overflow-y-auto bg-white/70 rounded border border-amber-300/80 p-2 space-y-1">
                          <span className="font-semibold text-[11px] text-amber-950 block">
                            Arquivos pendentes de correspondência:
                          </span>
                          <ul className="divide-y divide-amber-200/60 font-mono text-[11px]">
                            {report.semCorrespondencia.map((item, idx) => (
                              <li
                                key={item.file.name + idx}
                                className="py-1 break-all select-all text-amber-950 flex items-center justify-between gap-2"
                                title={item.file.name}
                              >
                                <span>{item.file.name}</span>
                                <span className="text-[10px] text-amber-800 font-sans shrink-0">
                                  {(item.file.size / 1024).toFixed(0)} KB
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Tabbed Table Preview */}
          <Card className="shadow-sm border">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-[#0b3c26]" />
                    Lista de Arquivos e Prévia de Vínculo
                  </CardTitle>
                  <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as any)}
                    className="w-full sm:w-auto"
                  >
                    <TabsList className="grid grid-cols-5 w-full sm:w-auto h-9">
                      <TabsTrigger value="todos" className="text-xs">
                        Todos ({items.length})
                      </TabsTrigger>
                      <TabsTrigger value="pronto" className="text-xs">
                        Prontos ({countPronto})
                      </TabsTrigger>
                      <TabsTrigger value="ambiguo" className="text-xs">
                        Ambíguos ({countAmbiguo})
                      </TabsTrigger>
                      <TabsTrigger value="sem_match" className="text-xs">
                        Sem Match ({countSemMatch})
                      </TabsTrigger>
                      <TabsTrigger value="concluido" className="text-xs">
                        Enviados ({countSucesso})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Banner de Ação em Massa na aba Ambíguos */}
                {activeTab === 'ambiguo' && countAmbiguo > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-amber-50/90 border-2 border-amber-300 rounded-xl">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span className="text-sm font-bold text-amber-950">
                          {countAmbiguo} arquivo(s) possuem mais de uma versão sugerida
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Você pode aceitar a melhor sugestão de todos de uma só vez (sem conflitos)
                        ou escolher individualmente linha por linha.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="default"
                      onClick={() => setConfirmBulkDialogOpen(true)}
                      disabled={importing || countAmbiguo === 0}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 shadow-sm text-sm h-10 px-4 shrink-0"
                    >
                      <Sparkles className="w-4 h-4" />
                      Aceitar todas as sugestões ({countAmbiguo})
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4 p-0 sm:p-4">
              <div className="border rounded-lg overflow-x-auto bg-slate-50/30">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="text-xs font-bold w-16 text-center">Prévia</TableHead>
                      <TableHead className="text-xs font-bold min-w-[220px]">
                        Nome do Arquivo
                      </TableHead>
                      <TableHead className="text-xs font-bold min-w-[130px]">
                        Tipo de Casamento
                      </TableHead>
                      <TableHead className="text-xs font-bold min-w-[280px]">
                        Versão Casada (com Foto Atual se houver)
                      </TableHead>
                      <TableHead className="text-xs font-bold min-w-[120px]">Status</TableHead>
                      <TableHead className="text-xs font-bold w-24 text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedItems.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-10 text-sm text-muted-foreground"
                        >
                          Nenhum arquivo nesta aba.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedItems.map((item) => {
                        const originalIndex = items.findIndex((it) => it.file === item.file)
                        const previewSrc = item.uploadedUrl || previewUrls.get(item.file)
                        return (
                          <TableRow
                            key={item.file.name + originalIndex}
                            className="hover:bg-white/80 transition-colors"
                          >
                            {/* Nova foto (miniatura do arquivo enviado) */}
                            <TableCell className="text-center p-2.5">
                              {previewSrc ? (
                                <img
                                  src={previewSrc}
                                  alt={item.file.name}
                                  loading="lazy"
                                  className="w-12 h-12 object-contain rounded-md border-2 border-slate-200 bg-white p-0.5 mx-auto shadow-sm"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-md border-2 border-dashed border-slate-200 bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                                  <FileImage className="w-5 h-5" />
                                </div>
                              )}
                            </TableCell>

                            {/* Nome do arquivo */}
                            <TableCell className="text-xs font-mono font-medium min-w-[220px]">
                              <span
                                className="block font-semibold text-sm text-slate-900 break-all select-all leading-snug"
                                title={item.file.name}
                              >
                                {item.file.name}
                              </span>
                              <span className="text-[11px] text-muted-foreground font-sans block mt-0.5">
                                {(item.file.size / 1024).toFixed(0)} KB &bull;{' '}
                                {item.parsed.extension.toUpperCase()}
                              </span>
                            </TableCell>

                            {/* Match Type */}
                            <TableCell className="text-xs">
                              {item.matchType === 'cod_erp' && (
                                <Badge className="bg-emerald-700 text-white gap-1 text-[11px]">
                                  <Check className="w-3 h-3" /> Cód. ERP
                                </Badge>
                              )}
                              {item.matchType === 'reg' && (
                                <Badge className="bg-emerald-600 text-white gap-1 text-[11px]">
                                  <Check className="w-3 h-3" /> REG Exato
                                </Badge>
                              )}
                              {item.matchType === 'nome_abreviado' && (
                                <Badge className="bg-teal-600 text-white gap-1 text-[11px]">
                                  <Sparkles className="w-3 h-3" /> Nome Abreviado
                                </Badge>
                              )}
                              {item.matchType === 'nome' && (
                                <Badge className="bg-teal-700 text-white gap-1 text-[11px]">
                                  <Sparkles className="w-3 h-3" /> Nome Versão
                                </Badge>
                              )}
                              {item.isAmbiguous && (
                                <Badge
                                  variant="outline"
                                  className="text-amber-800 bg-amber-50 border-amber-400 gap-1 text-[11px]"
                                >
                                  <AlertTriangle className="w-3 h-3 text-amber-600" /> Ambíguo
                                </Badge>
                              )}
                              {item.matchType === 'nenhum' && !item.isAmbiguous && (
                                <Badge
                                  variant="outline"
                                  className="text-slate-600 border-slate-300 text-[11px]"
                                >
                                  Não Encontrado
                                </Badge>
                              )}
                            </TableCell>

                            {/* Versão casada com miniatura atual se houver */}
                            <TableCell className="text-xs max-w-[300px]">
                              {item.matchedVersao ? (
                                <div className="flex items-center gap-3">
                                  {/* Miniatura atual da versão no banco */}
                                  <div className="shrink-0 text-center">
                                    {item.matchedVersao.imagem_preview ? (
                                      <div title="Foto atual da versão já gravada no catálogo">
                                        <img
                                          src={item.matchedVersao.imagem_preview}
                                          alt="Foto atual"
                                          className="w-10 h-10 object-contain rounded border border-amber-300 bg-amber-50/50 p-0.5"
                                        />
                                        <span className="text-[9px] text-amber-800 block font-medium">
                                          Já tem foto
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="w-10 h-10 rounded border border-dashed border-emerald-400 bg-emerald-50/50 flex flex-col items-center justify-center text-[9px] text-emerald-800 font-medium">
                                        <span>Sem</span>
                                        <span>foto</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <span
                                      className="font-bold text-slate-900 block text-xs break-words"
                                      title={item.matchedVersao.nome}
                                    >
                                      {item.matchedVersao.nome}
                                    </span>
                                    <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
                                      <span className="font-semibold text-emerald-900">
                                        ERP: {item.matchedVersao.cod_erp || '—'}
                                      </span>
                                      &bull;
                                      <span>REG: {item.matchedVersao.reg || '—'}</span>
                                      {item.matchedVersao.marca_nome && (
                                        <>
                                          &bull;
                                          <span className="uppercase text-[10px] font-bold text-slate-700">
                                            {item.matchedVersao.marca_nome}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    {item.matchReason && (
                                      <p
                                        className="text-[10px] text-emerald-800 italic mt-0.5 break-words"
                                        title={item.matchReason}
                                      >
                                        {item.matchReason}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {item.isAmbiguous ? (
                                    <p className="text-amber-800 text-xs font-semibold flex items-center gap-1">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                      {item.matchReason ||
                                        'Múltiplas versões encontradas. Decisão manual necessária.'}
                                    </p>
                                  ) : (
                                    <p className="text-slate-500 text-xs italic">
                                      Nenhuma versão encontrada. Renomeie o arquivo com o Cód. ERP
                                      (ex: <code className="font-mono font-semibold">1460.jpg</code>
                                      ) ou escolha manualmente.
                                    </p>
                                  )}
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                    {item.isAmbiguous &&
                                      item.candidates &&
                                      item.candidates.length > 0 && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={() =>
                                            handleAcceptSingleSuggestion(originalIndex)
                                          }
                                          disabled={importing}
                                          className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1.5 shadow-xs"
                                          title={`Aceitar primeira sugestão: "${item.candidates[0].versao.nome}"`}
                                        >
                                          <Check className="w-3.5 h-3.5" /> Aceitar sugestão
                                        </Button>
                                      )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenManualSelect(originalIndex)}
                                      disabled={importing}
                                      className="h-7 text-xs border-emerald-600/40 text-[#0b3c26] hover:bg-[#0b3c26]/10 gap-1.5"
                                    >
                                      <Search className="w-3 h-3" /> Escolher Manualmente
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </TableCell>

                            {/* Status */}
                            <TableCell className="text-xs">
                              {item.status === 'sucesso' && (
                                <Badge className="bg-emerald-600 text-white gap-1 text-[11px] font-medium py-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Gravada
                                </Badge>
                              )}
                              {item.status === 'uploading' && (
                                <Badge className="bg-blue-600 text-white gap-1 text-[11px] font-medium py-1">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Enviando
                                </Badge>
                              )}
                              {item.status === 'pronto' && (
                                <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-semibold py-1">
                                  Pronta
                                </Badge>
                              )}
                              {item.status === 'erro' && (
                                <Badge variant="destructive" className="gap-1 text-[11px] py-1">
                                  <XCircle className="w-3.5 h-3.5" /> Erro
                                </Badge>
                              )}
                              {item.status === 'sem_match' && (
                                <Badge
                                  variant="outline"
                                  className="text-slate-600 border-slate-300 text-[11px] py-1"
                                >
                                  Pendente
                                </Badge>
                              )}
                              {item.status === 'ambiguo' && (
                                <Badge
                                  variant="outline"
                                  className="text-amber-800 bg-amber-50 border-amber-300 text-[11px] py-1"
                                >
                                  Decisão Manual
                                </Badge>
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {item.matchedVersao && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenManualSelect(originalIndex)}
                                    title="Alterar versão vinculada"
                                    disabled={importing}
                                    className="h-8 w-8 text-slate-500 hover:text-slate-900"
                                  >
                                    <SlidersHorizontal className="w-4 h-4" />
                                  </Button>
                                )}
                                {item.uploadedUrl ? (
                                  <a
                                    href={item.uploadedUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 text-slate-500 hover:text-slate-800"
                                    title="Visualizar no bucket"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </a>
                                ) : (
                                  <button
                                    onClick={() => handleRemoveItem(originalIndex)}
                                    disabled={importing}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                                    title="Remover arquivo da lista"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Controles de Paginação Claros e Acessíveis */}
              {totalItems > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t bg-muted/20 rounded-b-lg">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      Mostrando{' '}
                      <strong className="text-foreground">{(safePage - 1) * pageSize + 1}</strong> a{' '}
                      <strong className="text-foreground">
                        {Math.min(safePage * pageSize, totalItems)}
                      </strong>{' '}
                      de <strong className="text-foreground">{totalItems}</strong> arquivo(s)
                    </span>
                    <span className="hidden sm:inline text-muted-foreground/50">|</span>
                    <span className="hidden sm:inline">
                      Página <strong className="text-foreground">{safePage}</strong> de{' '}
                      <strong className="text-foreground">{totalPages}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Seletor de itens por página */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="hidden md:inline">Itens por página:</span>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(val) => {
                          setPageSize(Number(val))
                          setPage(1)
                        }}
                      >
                        <SelectTrigger className="w-[100px] h-8 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="20">20 / pág</SelectItem>
                          <SelectItem value="25">25 / pág</SelectItem>
                          <SelectItem value="50">50 / pág</SelectItem>
                          <SelectItem value="100">100 / pág</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Botões de navegação */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={() => setPage(1)}
                        disabled={safePage <= 1}
                        title="Primeira página"
                      >
                        <ChevronsLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Primeira</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </Button>
                      <span className="text-xs px-2 font-medium text-slate-700 min-w-[70px] text-center">
                        {safePage} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                      >
                        Próxima
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={() => setPage(totalPages)}
                        disabled={safePage >= totalPages}
                        title="Última página"
                      >
                        <span className="hidden sm:inline">Última</span>
                        <ChevronsRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog para resolução manual de ambiguidades ou versões não encontradas */}
      <Dialog
        open={resolvingItemIndex !== null}
        onOpenChange={(open) => !open && setResolvingItemIndex(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0b3c26]">
              Vincular Arquivo a uma Versão
            </DialogTitle>
            <DialogDescription className="text-xs">
              Arquivo:{' '}
              <strong
                className="text-slate-900 font-mono break-all text-sm block mt-1"
                title={targetItemBeingResolved?.file.name}
              >
                {targetItemBeingResolved?.file.name}
              </strong>
            </DialogDescription>
          </DialogHeader>

          {/* Candidatos sugeridos pelo motor inteligente */}
          {targetItemBeingResolved?.candidates && targetItemBeingResolved.candidates.length > 0 && (
            <div className="space-y-1.5 border p-3 rounded-lg bg-amber-50/50 border-amber-200">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-700" /> Versões sugeridas pelo nome do
                arquivo:
              </span>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {targetItemBeingResolved.candidates.map((c) => (
                  <div
                    key={c.versao.id}
                    onClick={() => handleAssignManualVersao(c.versao)}
                    className="flex items-center justify-between p-2.5 rounded-md bg-white border border-amber-200 hover:border-emerald-600 hover:bg-emerald-50/50 cursor-pointer text-xs transition-colors gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <span
                        className="font-bold text-slate-900 block text-xs break-words"
                        title={c.versao.nome}
                      >
                        {c.versao.nome}
                      </span>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        ERP: {c.versao.cod_erp || '—'} &bull; REG: {c.versao.reg || '—'} &bull;{' '}
                        {c.versao.marca_nome || 'Sem marca'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="bg-[#0b3c26] text-white hover:bg-[#0b3c26]/90 text-xs h-7 shrink-0"
                    >
                      Escolher Esta
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Busca livre no catálogo completo de versões */}
          <div className="space-y-2 flex-1 min-h-0 flex flex-col">
            <span className="text-xs font-semibold text-slate-700">
              Ou busque qualquer versão cadastrada (por Cód. ERP, REG ou Nome):
            </span>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Ex: 1460, SE2208L, MAKINO D200, VKF..."
                value={manualSearchQuery}
                onChange={(e) => setManualSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-[#0b3c26]"
              />
            </div>

            <div className="flex-1 overflow-y-auto border rounded-lg divide-y max-h-64">
              {manualFilteredVersoes.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Nenhuma versão encontrada com o termo digitado.
                </div>
              ) : (
                manualFilteredVersoes.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => handleAssignManualVersao(v)}
                    className="p-2.5 flex items-center justify-between hover:bg-emerald-50/50 cursor-pointer text-xs transition-colors gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <span
                        className="font-semibold text-slate-900 block text-xs break-words"
                        title={v.nome}
                      >
                        {v.nome}
                      </span>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        ERP: <strong className="text-slate-800">{v.cod_erp || '—'}</strong> &bull;
                        REG: {v.reg || '—'} &bull; Marca: {v.marca_nome || '—'}{' '}
                        {v.imagem_preview && (
                          <span className="text-amber-700 font-medium ml-1">
                            (já possui imagem)
                          </span>
                        )}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 border-emerald-600 text-emerald-800 hover:bg-emerald-100 shrink-0"
                    >
                      Selecionar
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button variant="outline" size="sm" onClick={() => setResolvingItemIndex(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação para Aceitar Todas as Sugestões em Massa */}
      <Dialog open={confirmBulkDialogOpen} onOpenChange={setConfirmBulkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0b3c26] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              Confirmar Aceitação em Massa de Sugestões
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              O sistema aplicará a primeira/melhor sugestão de cada arquivo ambíguo e o promoverá
              para o fluxo normal (aba <strong>Prontos</strong>).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 min-h-0 flex flex-col overflow-y-auto py-2">
            {/* Resumo da Ação */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300">
                <span className="text-xs text-emerald-800 font-bold uppercase tracking-wider block">
                  Serão Vinculadas
                </span>
                <p className="text-2xl font-extrabold text-emerald-900 mt-1">
                  {bulkAcceptSimulation.itemsToPromote.length}
                </p>
                <span className="text-[11px] text-emerald-700 block mt-0.5">
                  imagens sem conflito
                </span>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-300">
                <span className="text-xs text-amber-800 font-bold uppercase tracking-wider block">
                  Continuam Ambíguas
                </span>
                <p className="text-2xl font-extrabold text-amber-900 mt-1">
                  {bulkAcceptSimulation.itemsRemainingAmbiguous.length}
                </p>
                <span className="text-[11px] text-amber-700 block mt-0.5">
                  com disputa ou já em uso
                </span>
              </div>
            </div>

            {/* Lista dos que serão vinculados */}
            {bulkAcceptSimulation.itemsToPromote.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Imagens que serão associadas ({bulkAcceptSimulation.itemsToPromote.length}):
                </span>
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y bg-white">
                  {bulkAcceptSimulation.itemsToPromote.map((item, i) => (
                    <div
                      key={item.file.name + i}
                      className="p-2.5 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-mono font-semibold text-slate-900 block break-all text-xs">
                          {item.file.name}
                        </span>
                        <div className="text-[11px] text-emerald-800 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>
                            &rarr; Versão: <strong>{item.versao.nome}</strong>
                          </span>
                          <span>
                            (ERP: {item.versao.cod_erp || '—'} &bull; REG: {item.versao.reg || '—'})
                          </span>
                        </div>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] shrink-0 font-medium">
                        Melhor sugestão
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aviso sobre os itens que continuam aguardando se houver */}
            {bulkAcceptSimulation.itemsRemainingAmbiguous.length > 0 && (
              <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-300 text-amber-950 space-y-1 text-xs">
                <p className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  Atenção: {bulkAcceptSimulation.itemsRemainingAmbiguous.length} arquivo(s)
                  continuarão aguardando sua decisão manual:
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Para garantir a integridade do catálogo, arquivos que disputam a mesma versão ou
                  que sugeriram uma versão já vinculada não serão alterados automaticamente.
                </p>
                <div className="max-h-28 overflow-y-auto divide-y divide-amber-200 border-t border-amber-200 pt-1 mt-1">
                  {bulkAcceptSimulation.itemsRemainingAmbiguous.map((amb, i) => (
                    <div key={amb.file.name + i} className="py-1 text-[11px]">
                      <span className="font-mono font-semibold">{amb.file.name}</span>
                      <span className="text-amber-800 block text-[10px]">{amb.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-2.5 rounded-lg bg-slate-50 border text-slate-600 text-xs">
              <p>
                <strong>Proteção de dados:</strong> fotos existentes no cadastro de versões nunca
                são apagadas ou sobrescritas. Os itens aceitos poderão ser conferidos na aba{' '}
                <strong>Prontos</strong> antes do envio final.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmBulkDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmBulkAccept}
              disabled={bulkAcceptSimulation.itemsToPromote.length === 0}
              className="bg-[#0b3c26] hover:bg-[#0b3c26]/90 text-white font-bold gap-2"
            >
              <Check className="w-4 h-4" />
              Confirmar e Vincular {bulkAcceptSimulation.itemsToPromote.length} Imagem(ns)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
