import React, { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ArrowRight,
  Info,
  Check,
  FileText,
  HelpCircle,
  Sparkles,
  Layers,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { fetchTiposProposta } from '@/services/tipos-proposta'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  analyzeTiposPropostaFile,
  computeRowsFromMapping,
  executeTiposPropostaBatchImport,
  TARGET_FIELDS,
  type ParseTiposPropostaResult,
  type HeaderMappingDefinition,
  type ImportExecutionReport,
  type CsvDelimiter,
} from '@/lib/tipos-proposta-importer'
import { TipoProposta } from '@/types/tipo-proposta'
import { parseParagraphs, stripBoldMarkers } from '@/lib/paragraphs'

interface TiposPropostaBatchImporterProps {
  onSuccess?: () => void
  onClose?: () => void
}

export function TiposPropostaBatchImporter({
  onSuccess,
  onClose,
}: TiposPropostaBatchImporterProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [existingTipos, setExistingTipos] = useState<TipoProposta[]>([])
  const [analysis, setAnalysis] = useState<ParseTiposPropostaResult | null>(null)
  const [customMapping, setCustomMapping] = useState<HeaderMappingDefinition[]>([])
  const [selectedDelimiter, setSelectedDelimiter] = useState<CsvDelimiter | 'auto'>('auto')

  // Options
  const [allowInsertNew, setAllowInsertNew] = useState(false)
  const [activeTab, setActiveTab] = useState<'mapping' | 'preview' | 'problems'>('mapping')
  const [filterAction, setFilterAction] = useState<'all' | 'update' | 'insert' | 'skip'>('all')

  // Execution state
  const [importing, setImporting] = useState(false)
  const [progressPct, setProgressPct] = useState(0)
  const [progressCurrent, setProgressCurrent] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [report, setReport] = useState<ImportExecutionReport | null>(null)

  const handleFileProcess = async (
    selectedFile: File,
    delimiterOverride?: CsvDelimiter | 'auto',
  ) => {
    const nameLower = selectedFile.name.toLowerCase()
    const isSupported =
      nameLower.endsWith('.csv') ||
      nameLower.endsWith('.xlsx') ||
      nameLower.endsWith('.xls') ||
      nameLower.endsWith('.txt')

    if (!isSupported) {
      toast({
        title: 'Formato não suportado',
        description:
          'Por favor, selecione um arquivo no formato CSV (.csv) ou Excel (.xlsx, .xls).',
        variant: 'destructive',
      })
      return
    }

    setFile(selectedFile)
    setReport(null)
    setAnalyzing(true)

    const forcedDelim =
      delimiterOverride && delimiterOverride !== 'auto'
        ? delimiterOverride
        : selectedDelimiter !== 'auto'
          ? selectedDelimiter
          : undefined

    try {
      // Fetch existing tipos from database
      const existing = existingTipos.length > 0 ? existingTipos : await fetchTiposProposta(false)
      setExistingTipos(existing)

      const res = await analyzeTiposPropostaFile(selectedFile, existing, forcedDelim)
      setAnalysis(res)
      setCustomMapping(res.mapping)
      setActiveTab('mapping')

      toast({
        title: 'Arquivo carregado!',
        description: `${res.totalRows} linha(s) e ${res.headers.length} coluna(s) identificadas. Revise o mapeamento abaixo.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao analisar arquivo'
      toast({
        title: 'Erro ao ler arquivo',
        description: msg,
        variant: 'destructive',
      })
      setAnalysis(null)
      setFile(null)
      setExistingTipos([])
      setCustomMapping([])
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDelimiterChange = async (newVal: string) => {
    const delim = newVal as CsvDelimiter | 'auto'
    setSelectedDelimiter(delim)
    if (file) {
      await handleFileProcess(file, delim)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0])
    }
  }

  const handleReset = () => {
    setFile(null)
    setAnalysis(null)
    setCustomMapping([])
    setExistingTipos([])
    setSelectedDelimiter('auto')
    setReport(null)
    setProgressPct(0)
    setProgressCurrent(0)
    setProgressTotal(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Handle user changing mapping for a specific file header
  const handleMappingChange = (csvHeader: string, newDbColumnOrIgnore: string) => {
    if (!analysis) return

    const newDbColumn = newDbColumnOrIgnore === '__IGNORE__' ? null : newDbColumnOrIgnore

    // Create updated mapping
    const updatedMapping = customMapping.map((m) => {
      if (m.csvHeader === csvHeader) {
        const targetDef = TARGET_FIELDS.find((t) => t.key === newDbColumn)
        return {
          ...m,
          dbColumn: newDbColumn,
          label: targetDef ? targetDef.label : m.csvHeader,
          description: targetDef
            ? targetDef.description
            : 'Coluna ignorada. Não será gravada no banco de dados.',
          isMapped: newDbColumn !== null,
          isKey: newDbColumn === 'nome',
        }
      }
      // Rule 3: Each target field can only receive ONE column from the file.
      // If another column was previously mapped to this dbColumn, unmap it to avoid duplicate binding!
      if (newDbColumn && m.dbColumn === newDbColumn) {
        return {
          ...m,
          dbColumn: null,
          label: m.csvHeader,
          description: 'Coluna ignorada. Não será gravada no banco de dados.',
          isMapped: false,
          isKey: false,
        }
      }
      return m
    })

    setCustomMapping(updatedMapping)

    // Recalculate preview & counts in real time
    const updatedAnalysis = computeRowsFromMapping(
      analysis.headers,
      analysis.rawRows,
      updatedMapping,
      existingTipos,
    )
    setAnalysis(updatedAnalysis)
  }

  const handleApplyImport = async () => {
    if (!analysis || analysis.rows.length === 0) return

    setImporting(true)
    setProgressPct(0)
    setProgressCurrent(0)
    setProgressTotal(analysis.rows.length)
    setReport(null)

    const userName = user?.name || user?.email || 'Administrador'

    try {
      // Re-fetch fresh tipos right before applying to ensure all existing IDs are latest
      const freshExisting = await fetchTiposProposta(false)
      setExistingTipos(freshExisting)

      // Re-compute rows to ensure matching is completely up to date
      const freshAnalysis = computeRowsFromMapping(
        analysis.headers,
        analysis.rawRows,
        customMapping,
        freshExisting,
      )
      setAnalysis(freshAnalysis)

      const res = await executeTiposPropostaBatchImport(freshAnalysis.rows, {
        allowInsertNew,
        userName,
        onProgress: (p) => {
          setProgressPct(p.percentage)
          setProgressCurrent(p.current)
          setProgressTotal(p.total)
        },
      })

      setReport(res)

      // Register in historico_importacoes
      try {
        const errList = res.errors.map(
          (e) => `Linha ${e.row}${e.nome ? ` (${e.nome})` : ''}: ${e.error}`,
        )
        await supabase.from('historico_importacoes').insert({
          tipo: 'Tipos de Proposta (Lote)',
          arquivo: file?.name || 'tipos_proposta.csv',
          status:
            res.errors.length === 0
              ? 'Concluído'
              : res.updatedCount > 0 || res.createdCount > 0
                ? 'Parcial'
                : 'Falha',
          registros_importados: res.updatedCount + res.createdCount,
          registros_erro: res.errors.length,
          erros: errList.length > 0 ? errList : null,
          usuario: userName,
        })
      } catch (logErr) {
        console.warn('Erro ao salvar histórico de importação:', logErr)
      }

      if (res.errors.length === 0) {
        toast({
          title: 'Importação concluída com sucesso!',
          description: `${res.updatedCount} tipos atualizados e ${res.createdCount} tipos criados.`,
        })
      } else {
        toast({
          title: 'Importação finalizada',
          description: `${res.updatedCount} atualizados, ${res.createdCount} criados, ${res.errors.length} com aviso.`,
          variant: res.updatedCount > 0 || res.createdCount > 0 ? 'default' : 'destructive',
        })
      }

      onSuccess?.()
    } catch (err: any) {
      toast({
        title: 'Erro ao aplicar importação',
        description: err?.message || 'Falha na comunicação com o banco de dados.',
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  const filteredRows = (analysis?.rows || []).filter((r) => {
    if (filterAction === 'all') return true
    return r.action === filterAction
  })

  return (
    <div className="space-y-6">
      {/* Informative introduction designed for older audience - clear, large text */}
      <Alert className="bg-[#f0f7f3] border-[#0b3c26]/20 text-[#0b3c26]">
        <Info className="h-5 w-5 text-[#0b3c26] shrink-0 mt-0.5" />
        <div className="ml-2 space-y-1">
          <AlertTitle className="text-base font-bold text-[#0b3c26]">
            Atualização em Lote de Tipos de Proposta
          </AlertTitle>
          <AlertDescription className="text-sm text-[#0b3c26]/90 leading-relaxed">
            Selecione o arquivo CSV ou Excel que você recebeu do sistema anterior. O sistema fará a
            correspondência automática pelo <strong>Nome do Tipo</strong> e mostrará uma prévia
            completa antes de qualquer alteração ser gravada no banco de dados.
          </AlertDescription>
        </div>
      </Alert>

      {/* Upload Zone */}
      {!file && (
        <Card className="border-dashed border-2 border-slate-300 hover:border-[#0b3c26] transition-all bg-card shadow-sm">
          <CardContent className="p-8 sm:p-12">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center p-8 sm:p-10 rounded-xl cursor-pointer transition-all ${
                dragOver ? 'bg-[#0b3c26]/10 border-[#0b3c26] scale-[0.99]' : 'hover:bg-[#0b3c26]/5'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileProcess(e.target.files[0])
                  }
                }}
              />
              <div className="w-20 h-20 rounded-2xl bg-[#0b3c26] flex items-center justify-center mb-5 text-white shadow-md">
                <UploadCloud className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 text-center">
                Clique aqui para escolher o arquivo CSV ou arraste-o até aqui
              </h3>
              <p className="text-sm text-muted-foreground mt-2 text-center max-w-lg leading-relaxed">
                Compatível com arquivos separados por ponto-e-vírgula (;) ou vírgula (,), com aspas
                e decimais no padrão brasileiro.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <Badge variant="outline" className="text-xs py-1.5 px-3 bg-white">
                  <FileText className="w-4 h-4 mr-1.5 text-[#0b3c26]" /> Arquivo CSV (.csv)
                </Badge>
                <Badge variant="outline" className="text-xs py-1.5 px-3 bg-white">
                  <FileSpreadsheet className="w-4 h-4 mr-1.5 text-[#0b3c26]" /> Planilha Excel
                  (.xlsx, .xls)
                </Badge>
                <Badge variant="outline" className="text-xs py-1.5 px-3 bg-white">
                  <Sparkles className="w-4 h-4 mr-1.5 text-[#0b3c26]" /> Detecção Automática de
                  Cabeçalhos
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analyzing spinner */}
      {analyzing && (
        <Card className="border shadow-sm p-8 text-center bg-[#f0f7f3]">
          <div className="flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-[#0b3c26]" />
            <p className="text-base font-semibold text-[#0b3c26]">
              Lendo arquivo e localizando tipos no banco de dados...
            </p>
          </div>
        </Card>
      )}

      {/* After file analyzed */}
      {file && !analyzing && analysis && (
        <div className="space-y-6">
          {/* File summary bar */}
          <Card className="border-[#0b3c26]/20 bg-gradient-to-r from-white via-white to-[#0b3c26]/5 shadow-sm">
            <CardHeader className="py-4 px-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#0b3c26] text-white flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      {file.name}
                      <Badge className="bg-[#0b3c26] text-white text-xs font-normal">
                        {(file.size / 1024).toFixed(1)} KB
                      </Badge>
                      {analysis.detectedDelimiter && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-white text-slate-800 font-mono"
                        >
                          Separador ativo:{' '}
                          <strong className="ml-1 text-[#0b3c26]">
                            {analysis.detectedDelimiter === ';'
                              ? 'Ponto e vírgula (;)'
                              : analysis.detectedDelimiter === ','
                                ? 'Vírgula (,)'
                                : 'Tabulação (Tab)'}
                          </strong>
                        </Badge>
                      )}
                      {analysis.encodingUsed && analysis.encodingUsed !== 'xlsx' && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-white text-slate-600 font-mono"
                        >
                          Codificação: {analysis.encodingUsed.toUpperCase()}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Total de linhas no arquivo:{' '}
                      <strong className="text-slate-800">{analysis.totalRows}</strong> &bull;
                      Colunas identificadas:{' '}
                      <strong className="text-slate-800">{analysis.headers.length}</strong>
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Delimiter selector - prominent and legible */}
                  {!file.name.toLowerCase().endsWith('.xlsx') &&
                    !file.name.toLowerCase().endsWith('.xls') && (
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-xs">
                        <Label
                          htmlFor="delimiter-selector"
                          className="text-xs font-bold text-slate-800 whitespace-nowrap cursor-pointer"
                        >
                          Separador de Colunas:
                        </Label>
                        <Select
                          value={selectedDelimiter}
                          onValueChange={handleDelimiterChange}
                          disabled={importing}
                        >
                          <SelectTrigger
                            id="delimiter-selector"
                            className="h-9 w-52 text-xs font-medium bg-slate-50 border-slate-300"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto" className="text-xs font-medium">
                              Detecção Automática
                            </SelectItem>
                            <SelectItem value=";" className="text-xs font-semibold">
                              Ponto e vírgula (;) — Padrão Excel BR
                            </SelectItem>
                            <SelectItem value="," className="text-xs font-medium">
                              Vírgula (,)
                            </SelectItem>
                            <SelectItem value="&#9;" className="text-xs font-medium">
                              Tabulação (Tab)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                  {!importing && (
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="gap-2 border-[#0b3c26]/30 text-[#0b3c26] hover:bg-[#0b3c26]/10 h-10 px-4"
                    >
                      <RefreshCw className="w-4 h-4" /> Escolher Outro Arquivo
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs uppercase font-semibold text-muted-foreground">
                  Existentes (Atualização)
                </div>
                <div className="text-2xl font-bold text-blue-700 mt-1">{analysis.updateCount}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Tipos já cadastrados no banco
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-600 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs uppercase font-semibold text-muted-foreground">
                  Novos Tipos (Inserção)
                </div>
                <div className="text-2xl font-bold text-emerald-700 mt-1">
                  {analysis.insertCount}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {allowInsertNew ? 'Serão criados no banco' : 'Ignorados (desmarcado)'}
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs uppercase font-semibold text-muted-foreground">
                  Colisões Evitadas
                </div>
                <div className="text-2xl font-bold text-orange-600 mt-1">
                  {analysis.collisionCount || 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Duplicadas / 1ª aplicada</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs uppercase font-semibold text-muted-foreground">
                  Com Problemas
                </div>
                <div className="text-2xl font-bold text-amber-700 mt-1">{analysis.errorCount}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Nome vazio ou formato inválido
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Options Box: Checkbox to create new types */}
          <Card className="border-[#0b3c26]/20 bg-amber-50/40">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="allowInsert"
                  checked={allowInsertNew}
                  onCheckedChange={(val) => setAllowInsertNew(val === true)}
                  className="mt-1 h-5 w-5 border-slate-400 data-[state=checked]:bg-[#0b3c26]"
                />
                <div>
                  <Label
                    htmlFor="allowInsert"
                    className="text-base font-bold text-slate-900 cursor-pointer"
                  >
                    Criar tipos de proposta que ainda não existem no banco de dados (
                    {analysis.insertCount})
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Por padrão fica desmarcado para apenas <strong>atualizar</strong> os tipos já
                    existentes. Marque caso queira cadastrar novos registros encontrados no arquivo.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Missing Key Field Warning Banner */}
          {analysis.missingKeyColumn && (
            <Alert
              variant="destructive"
              className="bg-red-50 border-red-300 text-red-900 shadow-sm"
            >
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="ml-2 space-y-2 flex-1">
                <AlertTitle className="text-base font-bold text-red-950 flex items-center justify-between flex-wrap gap-2">
                  <span>Não encontrei a coluna com o nome do tipo</span>
                  {activeTab !== 'mapping' && (
                    <Button
                      size="sm"
                      onClick={() => setActiveTab('mapping')}
                      className="bg-red-700 hover:bg-red-800 text-white font-bold h-7 text-xs"
                    >
                      Ir para Mapeamento de Colunas
                    </Button>
                  )}
                </AlertTitle>
                <AlertDescription className="text-xs sm:text-sm text-red-900 leading-relaxed">
                  Não foi possível identificar automaticamente a coluna com o nome do tipo de
                  proposta. Acesse a aba{' '}
                  <strong>&quot;1. Mapeamento Manual de Colunas&quot;</strong> e selecione
                  manualmente no dropdown correspondente a opção{' '}
                  <strong>&quot;Nome do Tipo (Chave de correspondência única)&quot;</strong>. O
                  botão de confirmação permanecerá bloqueado até que a chave seja definida.
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Tabs: Mapping (Step 1) vs Preview (Step 2) vs Problems */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b pb-2">
            <div className="flex items-center gap-2">
              <Button
                variant={activeTab === 'mapping' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('mapping')}
                className={`text-xs font-semibold ${
                  activeTab === 'mapping' ? 'bg-[#0b3c26]' : 'border-slate-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5 mr-1.5" />
                1. Mapeamento Manual de Colunas ({customMapping.length})
              </Button>
              <Button
                variant={activeTab === 'preview' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('preview')}
                className={`text-xs font-semibold ${
                  activeTab === 'preview' ? 'bg-[#0b3c26]' : 'border-slate-300'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                2. Pré-visualização dos Dados ({analysis.rows.length})
              </Button>
              {analysis.collisionCount > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs bg-orange-50 text-orange-800 border-orange-300 font-medium"
                >
                  <AlertTriangle className="w-3 h-3 mr-1 text-orange-600" />
                  {analysis.collisionCount} colisão(ões) tratadas
                </Badge>
              )}

              {analysis.errorCount > 0 && (
                <Button
                  variant={activeTab === 'problems' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('problems')}
                  className={
                    activeTab === 'problems'
                      ? 'bg-amber-600 text-white text-xs font-semibold'
                      : 'text-amber-700 border-amber-300 text-xs font-semibold'
                  }
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  Problemas ({analysis.errorCount})
                </Button>
              )}
            </div>

            {activeTab === 'preview' && (
              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                <span className="text-muted-foreground mr-1">Filtrar:</span>
                <Button
                  variant={filterAction === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFilterAction('all')}
                >
                  Todos ({analysis.rows.length})
                </Button>
                <Button
                  variant={filterAction === 'update' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs text-blue-700"
                  onClick={() => setFilterAction('update')}
                >
                  Atualizações ({analysis.updateCount})
                </Button>
                <Button
                  variant={filterAction === 'insert' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs text-emerald-700"
                  onClick={() => setFilterAction('insert')}
                >
                  Novos ({analysis.insertCount})
                </Button>
                <Button
                  variant={filterAction === 'skip' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs text-slate-700"
                  onClick={() => setFilterAction('skip')}
                >
                  Pulados / Colisões ({analysis.rows.filter((r) => r.action === 'skip').length})
                </Button>
              </div>
            )}
          </div>

          {/* TAB 1: EDITABLE COLUMN MAPPING */}
          {activeTab === 'mapping' && (
            <div className="space-y-4">
              {/* If single merged header column detected (user's bug screenshot), show a prominent warning with one-click fix */}
              {analysis.headers.length === 1 && analysis.headers[0].includes(';') && (
                <Alert className="border-amber-400 bg-amber-50 text-amber-950">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <div className="ml-2">
                    <AlertTitle className="text-base font-bold text-amber-900">
                      Atenção: Seu arquivo parece usar ponto-e-vírgula (;)
                    </AlertTitle>
                    <AlertDescription className="text-xs text-amber-800 mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span>
                        O cabeçalho foi lido em uma única coluna. Clique no botão ao lado para
                        dividir as colunas usando ponto-e-vírgula imediatamente.
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleDelimiterChange(';')}
                        className="bg-[#0b3c26] hover:bg-[#082e1d] text-white shrink-0 font-bold"
                      >
                        Aplicar Ponto e Vírgula (;)
                      </Button>
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              <div className="bg-[#f0f7f3] border border-[#0b3c26]/20 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-[#0b3c26] shrink-0 mt-0.5" />
                <div className="text-sm text-slate-800 space-y-1">
                  <p className="font-bold text-[#0b3c26]">Como funciona o Mapeamento de Colunas:</p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    O sistema identificou{' '}
                    <strong>{analysis.headers.length} coluna(s) separadas</strong> no seu arquivo.
                    Para cada coluna encontrada (à esquerda), use o menu suspenso para escolher qual
                    campo do sistema ela deve preencher.
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                    &bull; O campo <strong className="text-emerald-800">Nome do Tipo</strong> é a
                    chave obrigatória que liga o arquivo aos tipos existentes no banco.
                    <br />
                    &bull; Cada campo do sistema só pode receber <strong>
                      uma única coluna
                    </strong>{' '}
                    do arquivo. Ao atribuir uma coluna, ela sai das opções das outras.
                    <br />
                    &bull; Toda alteração recalcula a pré-visualização e os totais imediatamente.
                  </p>
                </div>
              </div>

              {/* Quick Delimiter Switcher bar right above mapping table for maximum accessibility */}
              {!file.name.toLowerCase().endsWith('.xlsx') &&
                !file.name.toLowerCase().endsWith('.xls') && (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">
                        Separador aplicado ao arquivo:
                      </span>
                      <Badge className="bg-[#0b3c26] text-white font-mono text-xs">
                        {analysis.detectedDelimiter === ';'
                          ? 'Ponto e vírgula (;)'
                          : analysis.detectedDelimiter === ','
                            ? 'Vírgula (,)'
                            : 'Tabulação (Tab)'}
                      </Badge>
                      <span className="text-muted-foreground">
                        ({analysis.headers.length} colunas identificadas)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 mr-1">Trocar separador:</span>
                      <Button
                        type="button"
                        variant={analysis.detectedDelimiter === ';' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleDelimiterChange(';')}
                        className={`h-7 text-xs font-semibold ${
                          analysis.detectedDelimiter === ';'
                            ? 'bg-[#0b3c26] text-white hover:bg-[#082e1d]'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        Ponto e vírgula (;)
                      </Button>
                      <Button
                        type="button"
                        variant={analysis.detectedDelimiter === ',' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleDelimiterChange(',')}
                        className={`h-7 text-xs font-semibold ${
                          analysis.detectedDelimiter === ','
                            ? 'bg-[#0b3c26] text-white hover:bg-[#082e1d]'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        Vírgula (,)
                      </Button>
                      <Button
                        type="button"
                        variant={analysis.detectedDelimiter === '\t' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleDelimiterChange('\t')}
                        className={`h-7 text-xs font-semibold ${
                          analysis.detectedDelimiter === '\t'
                            ? 'bg-[#0b3c26] text-white hover:bg-[#082e1d]'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        Tab
                      </Button>
                    </div>
                  </div>
                )}

              <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="text-xs">
                      <TableHead className="w-1/3 py-3 font-bold text-slate-800">
                        Coluna no seu Arquivo
                      </TableHead>
                      <TableHead className="w-12 text-center"></TableHead>
                      <TableHead className="w-1/2 py-3 font-bold text-slate-800">
                        Campo de Destino no Sistema
                      </TableHead>
                      <TableHead className="w-32 py-3 text-center font-bold text-slate-800">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customMapping.map((m) => {
                      const currentValue = m.dbColumn || '__IGNORE__'
                      const isKeyField = m.dbColumn === 'nome'

                      // Collect all other mapped dbColumns to prevent duplicate bindings (Rule 3)
                      const mappedInOtherColumns = new Set(
                        customMapping
                          .filter((other) => other.csvHeader !== m.csvHeader && other.dbColumn)
                          .map((other) => other.dbColumn as string),
                      )

                      return (
                        <TableRow
                          key={m.csvHeader}
                          className={`text-xs hover:bg-slate-50/80 transition-colors ${
                            isKeyField ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          {/* Coluna no Arquivo */}
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                {m.csvHeader}
                              </span>
                              {isKeyField && (
                                <Badge className="bg-emerald-600 text-white text-[10px] font-bold py-0.5 px-1.5 uppercase">
                                  Chave
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-1">
                              Primeira linha com valor:{' '}
                              <span className="italic text-slate-700 font-mono">
                                {analysis.rawRows[0]?.[m.csvHeader] || '(vazio)'}
                              </span>
                            </div>
                          </TableCell>

                          {/* Seta indicativa */}
                          <TableCell className="text-center text-muted-foreground">
                            <ArrowRight className="w-4 h-4 mx-auto text-slate-400" />
                          </TableCell>

                          {/* Seletor do Campo Alvo */}
                          <TableCell className="py-3">
                            <div className="space-y-1 max-w-md">
                              <Select
                                value={currentValue}
                                onValueChange={(val) => handleMappingChange(m.csvHeader, val)}
                              >
                                <SelectTrigger
                                  className={`h-11 text-sm font-medium bg-white ${
                                    isKeyField
                                      ? 'border-emerald-600 text-emerald-950 font-bold ring-1 ring-emerald-500/30'
                                      : analysis.missingKeyColumn && !m.isMapped
                                        ? 'border-amber-400 text-amber-950 ring-2 ring-amber-300/40 bg-amber-50/20'
                                        : m.isMapped
                                          ? 'border-slate-300 text-slate-900'
                                          : 'border-slate-200 text-slate-500 italic'
                                  }`}
                                >
                                  <SelectValue />
                                </SelectTrigger>{' '}
                                <SelectContent className="max-h-72">
                                  <SelectItem
                                    value="__IGNORE__"
                                    className="text-slate-500 italic py-2"
                                  >
                                    &times; Ignorar esta coluna (não gravar no banco)
                                  </SelectItem>

                                  {analysis.missingKeyColumn && (
                                    <div className="p-2 bg-amber-50 text-amber-900 text-xs border rounded m-1 font-medium">
                                      ⚠️ Atenção: você precisa escolher qual coluna é o{' '}
                                      <strong>Nome do Tipo</strong> abaixo:
                                    </div>
                                  )}

                                  <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-muted-foreground bg-slate-50 border-y my-1">
                                    Campos Disponíveis do Sistema
                                  </div>

                                  {TARGET_FIELDS.map((tf) => {
                                    const isUsedElsewhere = mappedInOtherColumns.has(tf.key)
                                    return (
                                      <SelectItem
                                        key={tf.key}
                                        value={tf.key}
                                        disabled={isUsedElsewhere}
                                        className="py-2.5"
                                      >
                                        <div className="flex flex-col text-left">
                                          <span
                                            className={`font-semibold ${
                                              tf.isKey
                                                ? 'text-emerald-800 font-bold'
                                                : 'text-slate-900'
                                            }`}
                                          >
                                            {tf.label}
                                            {tf.isKey && (
                                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded ml-2">
                                                CHAVE
                                              </span>
                                            )}
                                            {isUsedElsewhere && (
                                              <span className="text-[10px] text-amber-600 font-normal ml-2">
                                                (já atribuído a outra coluna)
                                              </span>
                                            )}
                                          </span>
                                          <span className="text-[11px] text-muted-foreground">
                                            {tf.description}
                                          </span>
                                        </div>
                                      </SelectItem>
                                    )
                                  })}
                                </SelectContent>
                              </Select>

                              {m.description && (
                                <p className="text-[11px] text-muted-foreground leading-tight">
                                  {m.description}
                                </p>
                              )}
                            </div>
                          </TableCell>

                          {/* Status Badge */}
                          <TableCell className="text-center py-3">
                            {isKeyField ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold gap-1 px-2.5 py-1 text-xs">
                                <Check className="w-3.5 h-3.5" /> Chave do Tipo
                              </Badge>
                            ) : m.isMapped ? (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-semibold gap-1 px-2.5 py-1 text-xs hover:bg-blue-100">
                                <Check className="w-3.5 h-3.5" /> Mapeada
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-slate-500 bg-slate-50 gap-1 px-2.5 py-1 text-xs"
                              >
                                <Info className="w-3 h-3" /> Ignorada
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Navigation button to preview */}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setActiveTab('preview')}
                  className="bg-[#0b3c26] text-white hover:bg-[#082e1d] gap-2 font-semibold h-10 px-5"
                >
                  Ver Prévia com Este Mapeamento
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: Preview Table */}
          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-50 border rounded-lg p-3 text-xs text-slate-700">
                <span className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-4 h-4 text-[#0b3c26]" />
                  A prévia abaixo reflete o mapeamento de colunas atual. Se algo estiver incorreto,
                  você pode voltar na aba &quot;Mapeamento Manual&quot; a qualquer momento.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('mapping')}
                  className="h-7 text-xs border-[#0b3c26]/30 text-[#0b3c26]"
                >
                  <Layers className="w-3.5 h-3.5 mr-1" /> Ajustar Mapeamento
                </Button>
              </div>

              <div className="border rounded-lg bg-card overflow-x-auto max-h-[460px] shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow className="text-xs">
                      <TableHead className="w-16">Linha</TableHead>
                      <TableHead className="w-28">Ação Prevista</TableHead>
                      <TableHead className="min-w-[200px]">Nome do Tipo</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-24">Fator Nac.</TableHead>
                      <TableHead className="w-24">Comissão</TableHead>
                      <TableHead className="w-28">IPI / ICMS</TableHead>
                      <TableHead className="min-w-[200px]">Prazo Entrega</TableHead>
                      <TableHead className="min-w-[200px]">Cond. Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.slice(0, 100).map((row) => {
                      const isUpdate = row.action === 'update'
                      const isInsert = row.action === 'insert'
                      const isSkip = row.action === 'skip'

                      return (
                        <TableRow key={row.rawRowIndex} className="text-xs hover:bg-slate-50/80">
                          <TableCell className="font-mono text-muted-foreground">
                            {row.rawRowIndex}
                          </TableCell>
                          <TableCell>
                            {isUpdate && (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-semibold hover:bg-blue-100">
                                ATUALIZAR
                              </Badge>
                            )}
                            {isInsert && (
                              <Badge
                                className={`font-semibold ${allowInsertNew ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-300'}`}
                              >
                                {allowInsertNew ? 'CRIAR NOVO' : 'IGNORAR (NOVO)'}
                              </Badge>
                            )}
                            {isSkip && row.isCollision && (
                              <Badge className="bg-orange-100 text-orange-800 border-orange-300 font-semibold hover:bg-orange-100">
                                PULAR (COLISÃO)
                              </Badge>
                            )}
                            {isSkip && !row.isCollision && row.validationErrors.length > 0 && (
                              <Badge variant="destructive" className="font-semibold">
                                PULAR (ERRO)
                              </Badge>
                            )}
                            {isSkip && !row.isCollision && row.validationErrors.length === 0 && (
                              <Badge className="bg-slate-100 text-slate-600 border-slate-300 font-semibold">
                                PULAR
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900">
                                {row.nome || <span className="text-red-500 italic">Vazio</span>}
                              </span>
                              {row.matchMethod && row.matchMethod !== 'exact' && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 font-normal"
                                  title={`Casou por aproximação com "${row.matchedDbName}"`}
                                >
                                  Casou com: {row.matchedDbName}
                                </Badge>
                              )}
                            </div>
                            {row.reg && (
                              <span className="text-[10px] text-muted-foreground font-mono block">
                                Reg export: {row.reg}
                              </span>
                            )}
                            {/* Requirement 2: Notice about preserving database name */}
                            {row.nameDiffers && row.namePreservedNotice && (
                              <div className="text-[11px] text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 mt-1 font-normal">
                                ℹ {row.namePreservedNotice}
                              </div>
                            )}
                            {/* Requirement 3: Warning about collision on first row */}
                            {row.collidingOtherRowsMessage && (
                              <div className="text-[11px] text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-1 font-normal">
                                ⚠️ {row.collidingOtherRowsMessage}
                              </div>
                            )}
                            {/* Requirement 3: Warning about collision on duplicate rows */}
                            {row.isCollision && row.collisionMessage && (
                              <div className="text-[11px] text-orange-900 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 mt-1 font-normal">
                                ⚠️ {row.collisionMessage}
                              </div>
                            )}
                            {row.validationErrors.length > 0 && (
                              <div className="text-[10px] text-red-600 font-normal mt-0.5">
                                {row.validationErrors.join(' • ')}
                              </div>
                            )}
                            {!row.existingId &&
                              !row.validationErrors.length &&
                              !row.isCollision && (
                                <div className="text-[10px] text-slate-500 font-normal mt-0.5 italic">
                                  {allowInsertNew
                                    ? 'Novo tipo: será cadastrado no banco'
                                    : 'Tipo não encontrado no banco (marque a opção acima se quiser cadastrá-lo)'}
                                </div>
                              )}
                          </TableCell>
                          <TableCell>
                            {row.status ? (
                              <div className="flex flex-col gap-0.5">
                                <Badge
                                  variant={row.status === 'Ativo' ? 'default' : 'secondary'}
                                  className="text-[11px] font-medium w-fit"
                                >
                                  {row.status}
                                </Badge>
                                {row.conversions?.status && (
                                  <span
                                    className="text-[10px] text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 font-mono w-fit"
                                    title="Valor convertido tolerante do arquivo"
                                  >
                                    {row.conversions.status.display}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">
                                manter atual
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.aplicar_fator_nac !== undefined ? (
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="outline" className="text-[11px] font-medium w-fit">
                                  {row.aplicar_fator_nac ? 'Sim' : 'Não'}
                                </Badge>
                                {row.conversions?.aplicar_fator_nac && (
                                  <span
                                    className="text-[10px] text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 font-mono w-fit"
                                    title="Valor convertido tolerante do arquivo"
                                  >
                                    {row.conversions.aplicar_fator_nac.display}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">
                                manter
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.comissao !== undefined ||
                            row.textFallbacks?.some((f) => f.column === 'comissao') ? (
                              <div className="flex flex-col gap-1">
                                {row.comissao !== undefined && (
                                  <span className="font-mono font-semibold text-slate-900 text-xs">
                                    {row.comissao}%
                                  </span>
                                )}
                                {row.conversions?.comissao && (
                                  <span
                                    className="text-[10px] text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 font-mono w-fit"
                                    title="Convertido com sucesso de texto/número do Excel"
                                  >
                                    {row.conversions.comissao.display}
                                  </span>
                                )}
                                {row.textFallbacks
                                  ?.filter((f) => f.column === 'comissao')
                                  .map((f) => (
                                    <div
                                      key={f.column}
                                      className="text-[10px] bg-sky-50 text-sky-900 border border-sky-200 rounded px-1.5 py-0.5 font-sans leading-tight"
                                      title={`Texto original: "${f.originalText}"`}
                                    >
                                      <span className="font-bold">Comissão:</span> texto longo →
                                      será salvo como informação adicional
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">
                                manter
                              </span>
                            )}
                          </TableCell>{' '}
                          <TableCell className="max-w-[260px] align-top">
                            {row.imposto_ipi ||
                            row.imposto_icms ||
                            row.selfReferencingCleared?.length ? (
                              <div className="flex flex-col gap-1.5 text-xs font-sans">
                                {row.imposto_ipi && (
                                  <div className="border-l-2 border-emerald-600/60 pl-1.5 py-0.5 bg-slate-50/70 rounded-xs">
                                    <div className="text-[9px] uppercase font-bold text-emerald-800 flex items-center justify-between">
                                      <span>IPI</span>
                                      {parseParagraphs(row.imposto_ipi).length > 1 && (
                                        <span className="text-[9px] font-normal text-emerald-600">
                                          {parseParagraphs(row.imposto_ipi).length} parágrafos
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      className="max-h-24 overflow-y-auto text-[11px] leading-snug text-slate-900 space-y-1"
                                      title={stripBoldMarkers(row.imposto_ipi)}
                                    >
                                      {parseParagraphs(row.imposto_ipi).map((p, idx) => (
                                        <div key={idx}>
                                          {p.title && (
                                            <strong className="block font-bold text-emerald-800">
                                              {p.title}
                                            </strong>
                                          )}
                                          {p.body && <span>{p.body}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {row.imposto_icms && (
                                  <div className="border-l-2 border-blue-600/60 pl-1.5 py-0.5 bg-slate-50/70 rounded-xs">
                                    <div className="text-[9px] uppercase font-bold text-blue-800 flex items-center justify-between">
                                      <span>ICMS</span>
                                      {parseParagraphs(row.imposto_icms).length > 1 && (
                                        <span className="text-[9px] font-normal text-blue-600">
                                          {parseParagraphs(row.imposto_icms).length} parágrafos
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      className="max-h-24 overflow-y-auto text-[11px] leading-snug text-slate-900 space-y-1"
                                      title={stripBoldMarkers(row.imposto_icms)}
                                    >
                                      {parseParagraphs(row.imposto_icms).map((p, idx) => (
                                        <div key={idx}>
                                          {p.title && (
                                            <strong className="block font-bold text-blue-800">
                                              {p.title}
                                            </strong>
                                          )}
                                          {p.body && <span>{p.body}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {row.selfReferencingCleared
                                  ?.filter(
                                    (c) =>
                                      c.column === 'imposto_ipi' || c.column === 'imposto_icms',
                                  )
                                  .map((c) => (
                                    <div
                                      key={c.column}
                                      className="text-[10px] bg-slate-100 text-slate-700 border border-slate-300 rounded px-1.5 py-0.5 font-sans leading-tight"
                                      title={`Valor original: "${c.originalText}" sob a coluna "${c.label}"`}
                                    >
                                      <span className="font-semibold text-slate-900">
                                        {c.label}:
                                      </span>{' '}
                                      repete o nome da coluna → tratado como vazio
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <span className="italic text-[11px] text-muted-foreground">
                                manter
                              </span>
                            )}
                          </TableCell>{' '}
                          <TableCell
                            className="max-w-[240px] align-top"
                            title={stripBoldMarkers(row.prazo_entrega)}
                          >
                            {row.prazo_entrega ? (
                              <div className="max-h-24 overflow-y-auto leading-relaxed text-[11px] font-sans border-l-2 border-emerald-600/40 pl-1.5 py-0.5 bg-slate-50/60 rounded-xs space-y-1">
                                {parseParagraphs(row.prazo_entrega).map((p, idx) => (
                                  <div key={idx}>
                                    {p.title && (
                                      <strong className="block font-bold text-emerald-800">
                                        {p.title}
                                      </strong>
                                    )}
                                    {p.body && <span>{p.body}</span>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">
                                manter atual
                              </span>
                            )}
                          </TableCell>
                          <TableCell
                            className="max-w-[240px] align-top"
                            title={stripBoldMarkers(row.condicoes_pagamento)}
                          >
                            {row.condicoes_pagamento ? (
                              <div className="max-h-24 overflow-y-auto leading-relaxed text-[11px] font-sans border-l-2 border-blue-600/40 pl-1.5 py-0.5 bg-slate-50/60 rounded-xs space-y-1">
                                {parseParagraphs(row.condicoes_pagamento).map((p, idx) => (
                                  <div key={idx}>
                                    {p.title && (
                                      <strong className="block font-bold text-blue-800">
                                        {p.title}
                                      </strong>
                                    )}
                                    {p.body && <span>{p.body}</span>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">
                                manter atual
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {filteredRows.length > 100 && (
                <p className="text-xs text-muted-foreground text-center">
                  Exibindo as primeiras 100 linhas de {filteredRows.length} filtradas. Todas serão
                  processadas na confirmação.
                </p>
              )}
            </div>
          )}

          {/* TAB 3: Problems List */}
          {activeTab === 'problems' && (
            <div className="space-y-3">
              <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <AlertTitle className="font-semibold text-sm">
                  {analysis.errorCount} linha(s) possuem inconsistências
                </AlertTitle>
                <AlertDescription className="text-xs text-amber-800 mt-1">
                  Essas linhas serão puladas automaticamente e <strong>não</strong> impedirão as
                  demais linhas válidas de serem importadas.
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg bg-card overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="text-xs">
                      <TableHead className="w-20">Linha</TableHead>
                      <TableHead className="w-1/3">Nome Informado</TableHead>
                      <TableHead>Motivo / Problema Detectado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.rows
                      .filter((r) => r.validationErrors.length > 0)
                      .map((r) => (
                        <TableRow key={r.rawRowIndex} className="text-xs">
                          <TableCell className="font-mono font-bold text-amber-900">
                            Linha {r.rawRowIndex}
                          </TableCell>
                          <TableCell className="font-medium">
                            {r.nome || <span className="text-red-500 italic">Vazio</span>}
                          </TableCell>
                          <TableCell className="text-red-600">
                            {r.validationErrors.join(' • ')}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Progress Bar during execution */}
          {importing && (
            <Card className="border shadow-sm p-6 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-2 text-[#0b3c26]">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Gravando alterações no banco de
                  dados...
                </span>
                <span className="font-mono text-xs">
                  {progressCurrent} de {progressTotal} ({progressPct}%)
                </span>
              </div>
              <Progress value={progressPct} className="h-3" />
            </Card>
          )}

          {/* Post-Import Execution Report */}
          {report && (
            <Card className="border-[#0b3c26]/30 bg-emerald-50/40 shadow-sm">
              <CardHeader className="py-4 px-6 border-b border-emerald-100">
                <CardTitle className="text-lg font-bold text-[#0b3c26] flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Relatório da Importação
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Resumo detalhado linha a linha das operações realizadas no banco de dados
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-white rounded-lg border border-emerald-200">
                    <div className="text-xs text-muted-foreground uppercase font-semibold">
                      Atualizados
                    </div>
                    <div className="text-2xl font-bold text-blue-700">{report.updatedCount}</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-emerald-200">
                    <div className="text-xs text-muted-foreground uppercase font-semibold">
                      Criados
                    </div>
                    <div className="text-2xl font-bold text-emerald-700">{report.createdCount}</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-emerald-200">
                    <div className="text-xs text-muted-foreground uppercase font-semibold">
                      Pulados
                    </div>
                    <div className="text-2xl font-bold text-slate-700">{report.skippedCount}</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-emerald-200">
                    <div className="text-xs text-muted-foreground uppercase font-semibold">
                      Erros
                    </div>
                    <div className="text-2xl font-bold text-red-600">
                      {report.errorCount ?? report.errors.length}
                    </div>
                  </div>
                </div>

                {/* Requirement 5: Complete line-by-line report with exact real database error */}
                <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs bg-white">
                  <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-[#0b3c26]" />
                      <h4 className="text-sm font-bold text-slate-900">
                        Relatório Linha a Linha ({report.items?.length || report.totalRows})
                      </h4>
                    </div>
                    <span className="text-xs text-slate-600">
                      Total: {report.totalRows} linha(s) processadas individualmente
                    </span>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0 z-10">
                        <TableRow className="text-xs">
                          <TableHead className="w-16 font-bold text-slate-800">Linha</TableHead>
                          <TableHead className="min-w-[220px] font-bold text-slate-800">
                            Nome no Arquivo
                          </TableHead>
                          <TableHead className="w-32 font-bold text-slate-800">Status</TableHead>
                          <TableHead className="font-bold text-slate-800">Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(report.items || []).map((item) => {
                          const isSuccess = item.status === 'atualizado' || item.status === 'criado'
                          const isErr = item.status === 'erro'
                          return (
                            <TableRow
                              key={item.row}
                              className={`text-xs ${
                                isErr
                                  ? 'bg-rose-50/50 hover:bg-rose-50'
                                  : isSuccess
                                    ? 'hover:bg-slate-50/60'
                                    : 'bg-slate-50/30 hover:bg-slate-50'
                              }`}
                            >
                              <TableCell className="font-mono font-bold text-slate-700">
                                #{item.row}
                              </TableCell>
                              <TableCell className="font-semibold text-slate-900">
                                {item.nome || (
                                  <span className="italic text-slate-400">Sem nome</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {item.status === 'atualizado' && (
                                  <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-semibold hover:bg-blue-100">
                                    Atualizado
                                  </Badge>
                                )}
                                {item.status === 'criado' && (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold hover:bg-emerald-100">
                                    Criado
                                  </Badge>
                                )}
                                {item.status === 'pulado' && (
                                  <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-medium hover:bg-slate-100">
                                    Pulado
                                  </Badge>
                                )}
                                {item.status === 'erro' && (
                                  <Badge variant="destructive" className="font-semibold">
                                    Com erro
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell
                                className={`leading-relaxed ${
                                  isErr
                                    ? 'text-rose-800 font-medium'
                                    : isSuccess
                                      ? 'text-emerald-900'
                                      : 'text-slate-600'
                                }`}
                              >
                                {item.motivo}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Você pode selecionar outro arquivo a qualquer momento para novas atualizações.
                  </p>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    className="gap-2 border-[#0b3c26]/30 text-[#0b3c26]"
                  >
                    <RefreshCw className="w-4 h-4" /> Importar Outro Arquivo
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Bar (Confirm & Apply) */}
          {!report && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-xl bg-slate-100 border border-slate-200">
              <div>
                <div className="text-base font-bold text-slate-900">Resumo da Execução:</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  <strong className="text-blue-700">{analysis.updateCount} tipos</strong> serão
                  atualizados
                  {allowInsertNew
                    ? `, ${analysis.insertCount} novos tipos serão criados`
                    : `, ${analysis.insertCount} novos tipos serão ignorados`}
                  {analysis.errorCount > 0
                    ? ` e ${analysis.errorCount} linha(s) com problema serão puladas.`
                    : '.'}
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {onClose && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={importing}
                    className="flex-1 sm:flex-initial h-11 px-5"
                  >
                    Cancelar
                  </Button>
                )}
                <Button
                  onClick={handleApplyImport}
                  disabled={
                    importing ||
                    analysis.missingKeyColumn ||
                    (analysis.updateCount === 0 && (!allowInsertNew || analysis.insertCount === 0))
                  }
                  title={
                    analysis.missingKeyColumn
                      ? 'Selecione qual coluna do arquivo é o Nome do Tipo'
                      : undefined
                  }
                  className="bg-[#0b3c26] hover:bg-[#082e1d] text-white flex-1 sm:flex-initial h-11 px-6 text-base font-bold shadow-md disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Gravando...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Confirmar e Aplicar Importação
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
