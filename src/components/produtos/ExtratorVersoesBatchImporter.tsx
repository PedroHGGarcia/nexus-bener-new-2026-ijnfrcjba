import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info,
  Layers,
  FileText,
  AlertCircle,
  Eye,
  Settings2,
  HelpCircle,
  Key,
  Database,
  ArrowRight,
  ShieldCheck,
  Check,
  Package,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { VersaoWithModelo } from '@/types/versao'
import { fetchVersoes } from '@/services/versoes'
import {
  TARGET_VERSAO_FIELDS,
  HeaderMappingDefinition,
  ParseVersoesResult,
  ImportVersoesExecutionReport,
  analyzeVersoesFile,
  computeVersoesRowsFromMapping,
  executeVersoesBatchImport,
} from '@/lib/extrator-versoes-importer'
import { VersaoRichText } from '@/lib/versao-rich-text'
import { formatCurrencyByMoeda } from '@/lib/format'

interface ExtratorVersoesImporterProps {
  onSuccess?: () => void
  onClose?: () => void
}

export function ExtratorVersoesImporter({ onSuccess, onClose }: ExtratorVersoesImporterProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [existingVersoes, setExistingVersoes] = useState<VersaoWithModelo[]>([])
  const [loadingExisting, setLoadingExisting] = useState(true)

  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [parseResult, setParseResult] = useState<ParseVersoesResult | null>(null)
  const [mapping, setMapping] = useState<HeaderMappingDefinition[]>([])

  // Options
  const [allowInsertNew, setAllowInsertNew] = useState(false) // Desmarcada por padrão conforme requisito!
  const [activeTab, setActiveTab] = useState<'previa' | 'mapeamento' | 'relatorio'>('previa')
  const [filterAction, setFilterAction] = useState<string>('todos')

  // Execution
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number; percentage: number }>({
    current: 0,
    total: 0,
    percentage: 0,
  })
  const [executionReport, setExecutionReport] = useState<ImportVersoesExecutionReport | null>(null)

  // 1. Carrega todas as versões existentes no banco para verificação de chaves
  const loadExistingVersoes = useCallback(async () => {
    setLoadingExisting(true)
    try {
      const data = await fetchVersoes()
      setExistingVersoes(data)
    } catch (err) {
      console.error('Erro ao carregar versões do banco:', err)
      toast({
        title: 'Aviso ao carregar dados',
        description:
          'Não foi possível carregar as versões existentes para comparação em tempo real.',
        variant: 'destructive',
      })
    } finally {
      setLoadingExisting(false)
    }
  }, [])

  useEffect(() => {
    loadExistingVersoes()
  }, [loadExistingVersoes])

  // 2. Processa o arquivo selecionado
  const handleFileProcess = async (selectedFile: File) => {
    setFile(selectedFile)
    setExecutionReport(null)
    setAnalyzing(true)

    try {
      const res = await analyzeVersoesFile(selectedFile, existingVersoes)
      setParseResult(res)
      setMapping(res.mapping)
      setActiveTab('previa')

      toast({
        title: 'Arquivo analisado!',
        description: `${res.totalRows} linhas lidas. ${res.updateCount} para atualizar, ${res.insertCount} novas.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar arquivo'
      toast({
        title: 'Erro ao ler arquivo',
        description: msg,
        variant: 'destructive',
      })
      setParseResult(null)
    } finally {
      setAnalyzing(false)
    }
  }

  // 3. Atualização de Mapeamento Manual de Colunas
  const handleMappingChange = (csvHeader: string, newDbCol: string | null) => {
    const updated = mapping.map((m) => {
      if (m.csvHeader === csvHeader) {
        const targetDef = TARGET_VERSAO_FIELDS.find((t) => t.key === newDbCol)
        return {
          ...m,
          dbColumn: newDbCol,
          label: targetDef ? targetDef.label : '(Não Mapeado)',
          description: targetDef ? targetDef.description : 'Coluna ignorada na gravação.',
          isMapped: newDbCol !== null,
          isKey: newDbCol === 'reg',
        }
      }
      // Se outra coluna já tinha esse mesmo dbColumn e não é nulo, desmarca a anterior
      if (newDbCol && m.dbColumn === newDbCol) {
        return {
          ...m,
          dbColumn: null,
          label: '(Não Mapeado)',
          description: 'Coluna ignorada na gravação.',
          isMapped: false,
          isKey: false,
        }
      }
      return m
    })

    setMapping(updated)

    if (parseResult) {
      const recomputed = computeVersoesRowsFromMapping(
        parseResult.headers,
        parseResult.rawRows,
        updated,
        existingVersoes,
      )
      setParseResult((prev) =>
        prev
          ? {
              ...recomputed,
              detectedDelimiter: prev.detectedDelimiter,
              encodingUsed: prev.encodingUsed,
            }
          : null,
      )
    }
  }

  // 4. Inicia a gravação
  const handleStartImport = async () => {
    if (!parseResult || parseResult.rows.length === 0) {
      toast({ title: 'Nenhum registro para importar', variant: 'destructive' })
      return
    }

    if (parseResult.missingKeyColumn) {
      toast({
        title: 'Coluna-chave obrigatória não mapeada',
        description: 'Vá na aba "Mapeamento Manual" e selecione qual coluna contém o REG.',
        variant: 'destructive',
      })
      setActiveTab('mapeamento')
      return
    }

    setImporting(true)
    setProgress({ current: 0, total: parseResult.rows.length, percentage: 0 })
    setExecutionReport(null)

    try {
      const report = await executeVersoesBatchImport(parseResult.rows, {
        allowInsertNew,
        userName: user?.name || user?.email || 'Admin',
        onProgress: (p) => setProgress(p),
      })

      setExecutionReport(report)
      setActiveTab('relatorio')

      // Recarrega lista existente de versões
      loadExistingVersoes()

      if (report.errorCount === 0) {
        toast({
          title: 'Importação finalizada com sucesso!',
          description: `${report.updatedCount} atualizadas, ${report.createdCount} criadas, ${report.totalTiposAssociados} tipos vinculados.`,
        })
      } else {
        toast({
          title: 'Importação concluída com pendências',
          description: `${report.updatedCount} atualizadas, ${report.createdCount} criadas, ${report.errorCount} erro(s).`,
          variant: 'destructive',
        })
      }

      onSuccess?.()
    } catch (err: any) {
      toast({
        title: 'Erro inesperado na importação',
        description: err?.message || String(err),
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setParseResult(null)
    setMapping([])
    setExecutionReport(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Linhas filtradas na prévia
  const filteredRows = useMemo(() => {
    if (!parseResult) return []
    if (filterAction === 'todos') return parseResult.rows
    if (filterAction === 'atualizar') return parseResult.rows.filter((r) => r?.action === 'update')
    if (filterAction === 'novos') return parseResult.rows.filter((r) => r?.action === 'insert')
    if (filterAction === 'erros')
      return parseResult.rows.filter((r) =>
        Array.isArray(r?.validationErrors) ? r.validationErrors.length > 0 : false,
      )
    if (filterAction === 'colisoes') return parseResult.rows.filter((r) => Boolean(r?.isCollision))
    return parseResult.rows
  }, [parseResult, filterAction])

  return (
    <div className="space-y-6">
      {/* 1. Header do Importador de Versões */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#0b3c26] flex items-center gap-2">
            <Package className="w-5 h-5 text-[#0b3c26]" />
            Importador de Versões de Produtos
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Importação e atualização a partir do extrator CSV (<code>extrator_versoes.csv</code>).
            Casamento por REG, formatação rica (&lt;B&gt;, \n, •) e vínculos de tipos de proposta.
          </p>
        </div>
        {file && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={importing}
            className="border-[#0b3c26]/30 text-[#0b3c26] hover:bg-[#0b3c26]/10 text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Escolher Outro Arquivo
          </Button>
        )}
      </div>

      {/* Regras e avisos importantes */}
      <Alert className="bg-[#f0f7f3] border-[#0b3c26]/30 text-[#0b3c26] py-3">
        <Info className="h-4 w-4 text-[#0b3c26]" />
        <AlertTitle className="font-semibold text-xs tracking-wide uppercase">
          Regras de Importação de Versões (extrator_versoes.csv)
        </AlertTitle>
        <AlertDescription className="text-xs text-[#0b3c26]/90 mt-1 space-y-1">
          <p>
            &bull; <strong>Identificação por REG:</strong> A coluna REG é a chave única. Se já
            existir no sistema, a versão será <strong>atualizada</strong>. Se não existir, reporta
            como nova versão (criação opcional).
          </p>
          <p>
            &bull; <strong>Célula Vazia = Manter Banco:</strong> Células em branco no arquivo{' '}
            <strong>NUNCA</strong> sobrescrevem valores já cadastrados.
          </p>
          <p>
            &bull; <strong>Formatação Rica:</strong> Tags <code>&lt;B&gt;</code>, quebras de linha e
            bullets <code>&bull;</code> são preservados no banco e convertidos visualmente sem
            marcações cruas.
          </p>
          <p>
            &bull; <strong>Tipos de Proposta (|):</strong> Valores separados por pipe criam o
            relacionamento na tabela de junção correspondente.
          </p>
        </AlertDescription>
      </Alert>

      {/* 2. Upload Dropzone */}
      {!file && (
        <Card className="border-dashed border-2 border-slate-300 hover:border-[#0b3c26] transition-all bg-card shadow-sm">
          <CardContent className="p-8">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleFileProcess(e.dataTransfer.files[0])
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center p-8 rounded-xl cursor-pointer transition-all ${
                dragOver ? 'bg-[#0b3c26]/10 border-[#0b3c26] scale-[0.99]' : 'hover:bg-[#0b3c26]/5'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, text/csv, .xlsx, .xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileProcess(e.target.files[0])
                  }
                }}
              />
              <div className="w-14 h-14 rounded-2xl bg-[#0b3c26] flex items-center justify-center mb-3 text-white shadow-md">
                <UploadCloud className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Selecione o arquivo extrator_versoes.csv (ou arraste aqui)
              </h3>
              <p className="text-xs text-muted-foreground mt-1 text-center max-w-md">
                Suporta CSV com separador ponto e vírgula (;), vírgula ou tabulação, com codificação
                UTF-8 ou Latin-1 automática.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Badge variant="outline" className="text-[11px] gap-1 py-0.5 px-2 bg-white">
                  <Key className="w-3 h-3 text-[#0b3c26]" /> Chave REG
                </Badge>
                <Badge variant="outline" className="text-[11px] gap-1 py-0.5 px-2 bg-white">
                  <Layers className="w-3 h-3 text-[#0b3c26]" /> Formatação Rica &lt;B&gt; / &bull;
                </Badge>
                <Badge variant="outline" className="text-[11px] gap-1 py-0.5 px-2 bg-white">
                  <Database className="w-3 h-3 text-[#0b3c26]" /> Preserva Vazio
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading de análise */}
      {analyzing && (
        <Card className="border shadow-sm p-6 text-center bg-[#f0f7f3]">
          <div className="flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#0b3c26]" />
            <p className="text-xs font-semibold text-[#0b3c26]">
              Lendo arquivo, detectando delimitador e casando versões cadastradas...
            </p>
          </div>
        </Card>
      )}

      {/* 3. Painel de Prévia, Mapeamento e Ações */}
      {file && !analyzing && parseResult && (
        <div className="space-y-5">
          {/* Barra de resumo do arquivo */}
          <Card className="shadow-xs border-[#0b3c26]/20 bg-muted/20">
            <CardHeader className="py-3 px-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#0b3c26] text-white flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      {file.name}
                      <Badge className="bg-[#0b3c26] text-white text-[10px] font-normal">
                        Separador: "{parseResult.detectedDelimiter || ';'}" &bull;{' '}
                        {parseResult.encodingUsed?.toUpperCase() || 'UTF-8'}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Total:{' '}
                      <strong className="text-foreground">{parseResult.totalRows} linhas</strong>{' '}
                      &bull;{' '}
                      <span className="text-emerald-700 font-semibold">
                        {parseResult.updateCount} para atualizar
                      </span>{' '}
                      &bull;{' '}
                      <span className="text-blue-700 font-semibold">
                        {parseResult.insertCount} novas
                      </span>
                      {parseResult.errorCount > 0 && (
                        <>
                          {' '}
                          &bull;{' '}
                          <span className="text-destructive font-semibold">
                            {parseResult.errorCount} erros
                          </span>
                        </>
                      )}
                    </CardDescription>
                  </div>
                </div>

                {/* Ações principais */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleStartImport}
                    disabled={importing || parseResult.missingKeyColumn}
                    className="bg-[#0b3c26] hover:bg-[#0b3c26]/90 text-white gap-2 text-xs font-semibold"
                  >
                    {importing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {importing ? 'Importando Linha a Linha...' : 'Confirmar e Aplicar Importação'}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Opção crítica: Criar versões não encontradas (desmarcada por padrão!) */}
          <div className="flex items-center justify-between p-3.5 bg-card border rounded-lg">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="allow-insert-versoes"
                checked={allowInsertNew}
                onCheckedChange={(checked) => setAllowInsertNew(Boolean(checked))}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <label
                  htmlFor="allow-insert-versoes"
                  className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-1.5"
                >
                  Criar novas versões que não existirem no sistema
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                    {allowInsertNew ? 'Ativado' : 'Desativado (Padrão Seguro)'}
                  </Badge>
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Quando desmarcado, linhas cujo REG não for encontrado no banco são reportadas na
                  prévia e <strong>não são criadas automaticamente</strong>.
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-muted-foreground">
                {parseResult.insertCount} versão(ões) nova(s) no arquivo
              </span>
            </div>
          </div>

          {/* Barra de progresso durante execução */}
          {importing && (
            <Card className="border border-[#0b3c26]/40 p-4 bg-[#f0f7f3]">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-[#0b3c26] flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Gravando versões linha a linha no banco...
                  </span>
                  <span className="font-bold text-[#0b3c26]">
                    {progress.current} / {progress.total} ({progress.percentage}%)
                  </span>
                </div>
                <Progress value={progress.percentage} className="h-2 bg-[#0b3c26]/20" />
              </div>
            </Card>
          )}

          {/* Abas: Prévia Rica / Mapeamento Manual / Relatório de Execução */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'previa' | 'mapeamento' | 'relatorio')}
          >
            <TabsList className="grid grid-cols-3 max-w-md">
              <TabsTrigger value="previa" className="text-xs gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Prévia com Formatação
              </TabsTrigger>
              <TabsTrigger value="mapeamento" className="text-xs gap-1.5">
                <Settings2 className="w-3.5 h-3.5" /> Mapeamento de Colunas
                {parseResult.missingKeyColumn && (
                  <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="relatorio"
                className="text-xs gap-1.5"
                disabled={!executionReport}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Relatório Final
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: PRÉVIA RICA */}
            <TabsContent value="previa" className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Filtrar linhas:</span>
                  <Select value={filterAction} onValueChange={setFilterAction}>
                    <SelectTrigger className="h-8 text-xs w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos ({parseResult.totalRows})</SelectItem>
                      <SelectItem value="atualizar">
                        Para Atualizar ({parseResult.updateCount})
                      </SelectItem>
                      <SelectItem value="novos">
                        Novas Versões ({parseResult.insertCount})
                      </SelectItem>
                      <SelectItem value="erros">Com Erros ({parseResult.errorCount})</SelectItem>
                      {parseResult.collisionCount > 0 && (
                        <SelectItem value="colisoes">
                          Colisões ({parseResult.collisionCount})
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground">
                  Exibindo {Math.min(filteredRows.length, 50)} de {filteredRows.length} linha(s)
                  filtrada(s)
                </div>
              </div>

              <div className="border rounded-lg bg-card overflow-x-auto max-h-[600px]">
                <Table className="text-xs">
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-12 text-center">Linha</TableHead>
                      <TableHead className="w-24">REG (Chave)</TableHead>
                      <TableHead className="min-w-[180px]">Versão</TableHead>
                      <TableHead className="w-24">Ação</TableHead>
                      <TableHead className="w-28">Preço Tabela</TableHead>
                      <TableHead className="min-w-[220px]">Acessórios Standards (Visual)</TableHead>
                      <TableHead className="min-w-[220px]">
                        Características Construtivas (Visual)
                      </TableHead>
                      <TableHead className="min-w-[220px]">
                        Especificações Técnicas (Visual)
                      </TableHead>
                      <TableHead className="w-48">Tipos de Proposta (|)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.slice(0, 50).map((row) => {
                      const isUpdate = row.action === 'update'
                      const isInsert = row.action === 'insert'
                      const isError =
                        (Array.isArray(row.validationErrors) && row.validationErrors.length > 0) ||
                        Boolean(row.isCollision)

                      return (
                        <TableRow
                          key={row.rawRowIndex}
                          className={
                            isError
                              ? 'bg-red-50/40 dark:bg-red-950/20'
                              : isUpdate
                                ? 'hover:bg-muted/40'
                                : 'bg-blue-50/30 dark:bg-blue-950/20 hover:bg-blue-50/50'
                          }
                        >
                          <TableCell className="text-center font-mono text-muted-foreground">
                            #{row.rawRowIndex}
                          </TableCell>
                          <TableCell className="font-mono font-bold text-[#0b3c26]">
                            {row.reg || '—'}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-foreground">{row.nome || '—'}</div>
                            {row.existingRecord && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                Casa com ID no banco: {row.existingRecord.nome}
                              </div>
                            )}
                            {Array.isArray(row.validationErrors) &&
                              row.validationErrors.length > 0 && (
                                <div className="text-[10px] text-destructive font-medium mt-1">
                                  {row.validationErrors.join(' | ')}
                                </div>
                              )}
                            {row.collisionMessage && (
                              <div className="text-[10px] text-amber-700 font-medium mt-1">
                                {row.collisionMessage}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {isUpdate ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-600/40 text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-[10px]"
                              >
                                Atualizar
                              </Badge>
                            ) : isInsert ? (
                              <Badge
                                variant="outline"
                                className="border-blue-600/40 text-blue-800 bg-blue-50 dark:bg-blue-950/40 text-[10px]"
                              >
                                Nova Versão
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">
                                Ignorar
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono">
                            {row.valor !== undefined
                              ? formatCurrencyByMoeda(row.valor, row.moeda || 'BRL')
                              : '—'}
                          </TableCell>

                          {/* Renderização rica de Acessórios Standards */}
                          <TableCell className="align-top max-w-xs">
                            {row.acessorios_standards ? (
                              <div className="p-2 rounded bg-muted/40 border border-border/50 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
                                <VersaoRichText content={row.acessorios_standards} />
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">—</span>
                            )}
                          </TableCell>

                          {/* Renderização rica de Características Construtivas */}
                          <TableCell className="align-top max-w-xs">
                            {row.caracteristicas_construtivas ? (
                              <div className="p-2 rounded bg-muted/40 border border-border/50 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
                                <VersaoRichText content={row.caracteristicas_construtivas} />
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">—</span>
                            )}
                          </TableCell>

                          {/* Renderização rica de Especificações Técnicas */}
                          <TableCell className="align-top max-w-xs">
                            {row.especificacoes_tecnicas ? (
                              <div className="p-2 rounded bg-muted/40 border border-border/50 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
                                <VersaoRichText content={row.especificacoes_tecnicas} />
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">—</span>
                            )}
                          </TableCell>

                          {/* Tipos de Proposta separados por | */}
                          <TableCell className="align-top">
                            {Array.isArray(row.tipos_proposta_list) &&
                            row.tipos_proposta_list.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {row.tipos_proposta_list.map((tipo, tIdx) => (
                                  <Badge
                                    key={tIdx}
                                    variant="outline"
                                    className="text-[10px] border-emerald-600/30 text-emerald-800 bg-emerald-50/60"
                                  >
                                    {String(tipo)}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ABA 2: MAPEAMENTO MANUAL DE COLUNAS */}
            <TabsContent value="mapeamento" className="space-y-4 pt-2">
              <div className="border rounded-lg bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Settings2 className="w-4 h-4 text-[#0b3c26]" />
                    Mapeamento das Colunas do Arquivo ({mapping.length} colunas encontradas)
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Coluna-chave: <strong className="text-[#0b3c26]">REG</strong> (Destacada)
                  </span>
                </div>

                <div className="border rounded-md overflow-hidden">
                  <Table className="text-xs">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-1/3">Coluna no Arquivo CSV</TableHead>
                        <TableHead className="w-1/3">Campo de Destino na Versão</TableHead>
                        <TableHead className="w-1/3">Descrição / Regra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mapping.map((m) => {
                        const isKey = m.dbColumn === 'reg'

                        return (
                          <TableRow
                            key={m.csvHeader}
                            className={
                              isKey ? 'bg-emerald-50/60 dark:bg-emerald-950/30 font-medium' : ''
                            }
                          >
                            <TableCell className="font-mono">
                              <div className="flex items-center gap-1.5">
                                {isKey && <Key className="w-3.5 h-3.5 text-[#0b3c26]" />}
                                <span>{m.csvHeader}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={m.dbColumn || '__none__'}
                                onValueChange={(val) =>
                                  handleMappingChange(m.csvHeader, val === '__none__' ? null : val)
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem
                                    value="__none__"
                                    className="text-muted-foreground italic"
                                  >
                                    (Ignorar / Não Mapear)
                                  </SelectItem>
                                  {TARGET_VERSAO_FIELDS.map((f) => (
                                    <SelectItem key={f.key} value={f.key}>
                                      {f.label} {f.isKey ? '★ (Chave)' : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-[11px]">
                              {m.description}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* ABA 3: RELATÓRIO FINAL DE EXECUÇÃO */}
            <TabsContent value="relatorio" className="space-y-4 pt-2">
              {executionReport && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200">
                      <div className="text-emerald-800 dark:text-emerald-300 font-medium">
                        Atualizadas com Sucesso
                      </div>
                      <div className="text-xl font-bold text-emerald-900 dark:text-emerald-200 mt-1">
                        {executionReport.updatedCount}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200">
                      <div className="text-blue-800 dark:text-blue-300 font-medium">
                        Novas Versões Criadas
                      </div>
                      <div className="text-xl font-bold text-blue-900 dark:text-blue-200 mt-1">
                        {executionReport.createdCount}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900 border-slate-200">
                      <div className="text-slate-600 dark:text-slate-400 font-medium">
                        Puladas / Mantidas
                      </div>
                      <div className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-1">
                        {executionReport.skippedCount}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200">
                      <div className="text-amber-800 dark:text-amber-300 font-medium">
                        Vínculos de Tipos Criados
                      </div>
                      <div className="text-xl font-bold text-amber-900 dark:text-amber-200 mt-1">
                        {executionReport.totalTiposAssociados}
                      </div>
                    </div>
                  </div>

                  {/* Tabela linha a linha com o status e erro real */}
                  <div className="border rounded-lg bg-card overflow-hidden">
                    <div className="p-3 border-b bg-muted/40 font-semibold text-xs text-foreground">
                      Detalhamento de Todas as Linhas Processadas
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      <Table className="text-xs">
                        <TableHeader className="bg-muted/50 sticky top-0">
                          <TableRow>
                            <TableHead className="w-14 text-center">Linha</TableHead>
                            <TableHead className="w-24">REG</TableHead>
                            <TableHead className="min-w-[180px]">Versão</TableHead>
                            <TableHead className="w-24">Resultado</TableHead>
                            <TableHead>Motivo / Resposta do Sistema</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {executionReport.items.map((item) => (
                            <TableRow key={item.row}>
                              <TableCell className="text-center font-mono text-muted-foreground">
                                #{item.row}
                              </TableCell>
                              <TableCell className="font-mono font-bold text-[#0b3c26]">
                                {item.reg}
                              </TableCell>
                              <TableCell className="font-medium text-foreground">
                                {item.nome}
                              </TableCell>
                              <TableCell>
                                {item.status === 'atualizado' ? (
                                  <Badge className="bg-emerald-600 text-white text-[10px]">
                                    Atualizado
                                  </Badge>
                                ) : item.status === 'criado' ? (
                                  <Badge className="bg-blue-600 text-white text-[10px]">
                                    Criado
                                  </Badge>
                                ) : item.status === 'pulado' ? (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Pulado
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-[10px]">
                                    Erro
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                <div>{item.motivo}</div>
                                {item.modeloResolvido?.status === 'encontrado' &&
                                  item.modeloResolvido.modeloNome && (
                                    <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                                      Modelo vinculado: {item.modeloResolvido.modeloNome}{' '}
                                      (referência: {item.modeloResolvido.original})
                                    </div>
                                  )}
                                {item.modeloResolvido?.status === 'nao_encontrado' && (
                                  <div className="text-[10px] text-amber-700 font-medium mt-0.5">
                                    Aviso de modelo:{' '}
                                    {item.modeloResolvido.aviso ||
                                      `modelo '${item.modeloResolvido.original}' não encontrado — campo modelo mantido/inexistente`}
                                  </div>
                                )}
                                {Array.isArray(item.tiposNaoEncontrados) &&
                                  item.tiposNaoEncontrados.length > 0 && (
                                    <div className="text-[10px] text-amber-700 mt-0.5">
                                      Tipos não localizados no sistema:{' '}
                                      {item.tiposNaoEncontrados.join(', ')}
                                    </div>
                                  )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
