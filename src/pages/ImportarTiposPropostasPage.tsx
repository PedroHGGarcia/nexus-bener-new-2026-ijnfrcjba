import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  ArrowRight,
  Info,
  Link2,
  FileText,
  AlertCircle,
  Sparkles,
  Layers,
  FileCheck,
  Building2,
  Database,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import {
  parseVersaoTiposImportFile,
  processarImportacaoVersaoTipos,
  type ParsedVersaoTipoSpreadsheetResult,
  type VersaoTipoImportReport,
} from '@/lib/versoes-tipos-proposta-importer'
import { TiposPropostaBatchImporter } from '@/components/propostas/TiposPropostaBatchImporter'

export default function ImportarTiposPropostasPage() {
  const [mainMode, setMainMode] = useState<'cadastro' | 'vinculos'>('cadastro')
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParsedVersaoTipoSpreadsheetResult | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string>('')

  // Execution state
  const [importing, setImporting] = useState(false)
  const [progressStage, setProgressStage] = useState<string>('')
  const [progressPct, setProgressPct] = useState<number>(0)
  const [progressCurrent, setProgressCurrent] = useState<number>(0)
  const [progressTotal, setProgressTotal] = useState<number>(0)

  // Results
  const [report, setReport] = useState<VersaoTipoImportReport | null>(null)

  const handleFileProcess = async (selectedFile: File, targetSheet?: string) => {
    const nameLower = selectedFile.name.toLowerCase()
    const isSupported =
      nameLower.endsWith('.xlsx') ||
      nameLower.endsWith('.xls') ||
      nameLower.endsWith('.csv') ||
      nameLower.endsWith('.txt')

    if (!isSupported) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione um arquivo de planilha (.xlsx, .xls) ou CSV (.csv).',
        variant: 'destructive',
      })
      return
    }

    setFile(selectedFile)
    setReport(null)
    setParsing(true)

    try {
      const result = await parseVersaoTiposImportFile(selectedFile, targetSheet)
      setParseResult(result)
      if (result.sheetName) {
        setSelectedSheet(result.sheetName)
      }
      toast({
        title: 'Arquivo carregado com sucesso!',
        description: `${result.totalRows} linhas identificadas no arquivo.`,
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
      setParsing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0])
    }
  }

  const handleSheetChange = async (sheetName: string) => {
    if (!file) return
    setSelectedSheet(sheetName)
    await handleFileProcess(file, sheetName)
  }

  const handleStartImport = async () => {
    if (!parseResult || parseResult.allRows.length === 0) {
      toast({
        title: 'Nenhum dado para importar',
        description: 'Carregue um arquivo válido com dados de versões e tipos de proposta.',
        variant: 'destructive',
      })
      return
    }

    setImporting(true)
    setProgressPct(0)
    setProgressCurrent(0)
    setProgressTotal(parseResult.allRows.length)
    setReport(null)

    try {
      const res = await processarImportacaoVersaoTipos(parseResult.allRows, {
        userName: user?.name || user?.email || 'Admin',
        userId: user?.id,
        onProgress: (p) => {
          setProgressPct(p.percentage)
          setProgressCurrent(p.current)
          setProgressTotal(p.total)
          if (p.message) {
            setProgressStage(p.message)
          } else {
            switch (p.stage) {
              case 'carregando_dados':
                setProgressStage('Carregando cadastro de versões e tipos de proposta...')
                break
              case 'processando':
                setProgressStage(`Processando e associando (${p.current}/${p.total})...`)
                break
              case 'salvando':
                setProgressStage(`Gravando vínculos no banco (${p.current}/${p.total})...`)
                break
              case 'concluido':
                setProgressStage('Concluído!')
                break
            }
          }
        },
      })

      setReport(res)

      // Audit log in historico_importacoes
      try {
        const errorList = [
          ...res.pendencias.map(
            (p) =>
              `Linha ${p.lineNumber} - Versão "${p.identificadorVersao}"${p.tipoPropostaItem ? ` - Tipo: "${p.tipoPropostaItem}"` : ''}: ${p.motivo}`,
          ),
          ...(res.errosGerais || []),
        ]

        await supabase.from('historico_importacoes').insert({
          tipo: 'Vínculos de Versões × Tipos de Proposta',
          arquivo: file?.name || 'versoes_tipos_proposta.csv',
          status:
            errorList.length === 0
              ? 'Concluído'
              : res.totalAssociacoesCriadas > 0
                ? 'Parcial'
                : 'Falha',
          registros_importados: res.totalAssociacoesCriadas,
          registros_erro: res.pendencias.length,
          erros: errorList.length > 0 ? errorList : null,
          usuario: user?.email || 'Admin',
        })
      } catch (auditErr) {
        console.warn('Erro ao registrar histórico de importação:', auditErr)
      }

      if (res.pendencias.length === 0 && (!res.errosGerais || res.errosGerais.length === 0)) {
        toast({
          title: 'Importação concluída com sucesso!',
          description: `${res.totalAssociacoesCriadas} novos vínculos criados entre versões e tipos de proposta (${res.totalVersoesProcessadas} versões processadas).`,
        })
      } else {
        toast({
          title: 'Importação finalizada com pendências',
          description: `${res.totalAssociacoesCriadas} vínculos criados, ${res.pendencias.length} pendência(s) encontrada(s).`,
          variant: 'destructive',
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro durante o processamento'
      toast({
        title: 'Falha na importação',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setParseResult(null)
    setSelectedSheet('')
    setReport(null)
    setProgressPct(0)
    setProgressCurrent(0)
    setProgressTotal(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header com identidade visual Bener */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#0b3c26]/10 text-[#0b3c26]">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0b3c26]">
                Importação de Tipos de Proposta
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Atualize o cadastro de tipos de proposta em lote ou vincule tipos às versões de
                máquinas.
              </p>
            </div>
          </div>
        </div>
        {mainMode === 'vinculos' && file && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={importing}
            className="gap-2 border-[#0b3c26]/30 text-[#0b3c26] hover:bg-[#0b3c26]/10"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Escolher Outro Arquivo
          </Button>
        )}
      </div>

      {/* Seletor de Modo de Importação */}
      <Tabs
        value={mainMode}
        onValueChange={(v) => setMainMode(v as 'cadastro' | 'vinculos')}
        className="space-y-6"
      >
        <TabsList className="grid w-full sm:w-[520px] grid-cols-2 p-1 bg-slate-100">
          <TabsTrigger
            value="cadastro"
            className="gap-2 py-2 data-[state=active]:bg-[#0b3c26] data-[state=active]:text-white font-semibold text-xs sm:text-sm"
          >
            <Database className="w-4 h-4" /> Atualizar Cadastro de Tipos
          </TabsTrigger>
          <TabsTrigger
            value="vinculos"
            className="gap-2 py-2 data-[state=active]:bg-[#0b3c26] data-[state=active]:text-white font-semibold text-xs sm:text-sm"
          >
            <Link2 className="w-4 h-4" /> Vínculos Tipos × Versões
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: Atualização do Cadastro de Tipos de Proposta em Lote */}
        <TabsContent
          value="cadastro"
          className="space-y-6 focus-visible:outline-none focus-visible:ring-0"
        >
          <TiposPropostaBatchImporter />
        </TabsContent>

        {/* ABA 2: Vínculos com Versões */}
        <TabsContent
          value="vinculos"
          className="space-y-6 focus-visible:outline-none focus-visible:ring-0"
        >
          {/* Info Banner explicativo */}
          <Alert className="bg-[#f0f7f3] border-[#0b3c26]/20 text-[#0b3c26]">
            <Info className="h-4 w-4 text-[#0b3c26]" />
            <AlertTitle className="font-semibold text-sm">
              Como funciona a importação de Versões × Tipos de Proposta
            </AlertTitle>
            <AlertDescription className="text-xs text-[#0b3c26]/90 mt-1 leading-relaxed space-y-1">
              <p>
                O arquivo deve conter a identificação da <strong>Versão</strong> (coluna{' '}
                <code>nome</code> ou <code>cod_erp</code>) e a coluna <code>tipo_proposta</code> (ou{' '}
                <code>tipos_proposta</code>
                ), onde múltiplos tipos podem ser informados separados pelo caractere pipe (
                <code>|</code>). Exemplo: <em>&quot;Venda Direta | Consórcio&quot;</em>.
              </p>
              <p>
                <strong>Regras de vínculo:</strong> O importador busca as versões primeiro por{' '}
                <code>cod_erp</code> e depois por <code>nome</code> (com tolerância a maiúsculas,
                minúsculas e acentos). Os tipos de proposta são localizados pelo nome. Vínculos já
                existentes são preservados sem duplicidade.{' '}
                <strong>Nenhum cadastro de versão ou tipo de proposta é criado ou alterado.</strong>
              </p>
            </AlertDescription>
          </Alert>

          {/* Step 1: Upload Dropzone */}
          {!file && (
            <Card className="border-dashed border-2 border-slate-300 hover:border-[#0b3c26] transition-all bg-card shadow-sm">
              <CardContent className="p-10">
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center p-10 rounded-xl cursor-pointer transition-all ${
                    dragOver
                      ? 'bg-[#0b3c26]/10 border-[#0b3c26] scale-[0.99]'
                      : 'hover:bg-[#0b3c26]/5'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileProcess(e.target.files[0])
                      }
                    }}
                  />
                  <div className="w-16 h-16 rounded-2xl bg-[#0b3c26] flex items-center justify-center mb-4 text-white shadow-md">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Arraste sua planilha CSV ou XLSX aqui
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1.5 text-center max-w-lg leading-relaxed">
                    ou clique para selecionar do seu dispositivo. O arquivo deve conter colunas de
                    versão (<code>nome</code>, <code>cod_erp</code>) e tipos de proposta (
                    <code>tipo_proposta</code>).
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                      <Building2 className="w-3.5 h-3.5 text-[#0b3c26]" /> Busca por Cód. ERP ou
                      Nome
                    </Badge>
                    <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                      <FileText className="w-3.5 h-3.5 text-[#0b3c26]" /> CSV (.csv)
                    </Badge>
                    <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#0b3c26]" /> Excel (.xlsx, .xls)
                    </Badge>
                    <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                      <Layers className="w-3.5 h-3.5 text-[#0b3c26]" /> Múltiplos Tipos por
                      &quot;|&quot;
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Parsing Loading */}
          {parsing && (
            <Card className="border shadow-sm p-8 text-center bg-[#f0f7f3]">
              <div className="flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-[#0b3c26]" />
                <p className="text-sm font-semibold text-[#0b3c26]">
                  Lendo e analisando o arquivo...
                </p>
              </div>
            </Card>
          )}

          {/* Step 2 & 3: File details, Preview & Execution */}
          {file && !parsing && parseResult && (
            <div className="space-y-6">
              {/* File summary bar */}
              <Card className="shadow-sm border-[#0b3c26]/20 bg-gradient-to-r from-white via-white to-[#0b3c26]/5">
                <CardHeader className="py-4 px-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#0b3c26] text-white flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                          {file.name}
                          <Badge className="bg-[#0b3c26] text-white text-[11px] font-normal">
                            Planilha de Versões × Tipos de Proposta
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground mt-0.5">
                          Tamanho: {(file.size / 1024).toFixed(1)} KB &bull; Total identificado:{' '}
                          <strong className="text-slate-800">
                            {parseResult.totalRows} registros
                          </strong>
                        </CardDescription>
                      </div>
                    </div>

                    {/* Sheet Selector if multiple sheets exist in XLSX */}
                    {parseResult.availableSheets && parseResult.availableSheets.length > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">Aba:</span>
                        <Select
                          value={selectedSheet}
                          onValueChange={handleSheetChange}
                          disabled={importing}
                        >
                          <SelectTrigger className="h-8 text-xs bg-white w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {parseResult.availableSheets.map((sh) => (
                              <SelectItem key={sh} value={sh} className="text-xs">
                                {sh}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </CardHeader>
              </Card>

              {/* Preview of first 5 rows */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-[#0b3c26]" />
                        Prévia das Primeiras 5 Linhas Lidas
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Confira a identificação das versões e a separação dos tipos de proposta
                        antes de iniciar o processamento.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Mostrando {Math.min(5, parseResult.totalRows)} de {parseResult.totalRows}{' '}
                      linhas
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="border rounded-lg overflow-x-auto bg-slate-50/50">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-100">
                          <TableHead className="text-xs font-bold w-16">Linha</TableHead>
                          <TableHead className="text-xs font-bold min-w-[240px]">
                            Identificador da Versão (Nome / Cód. ERP)
                          </TableHead>
                          <TableHead className="text-xs font-bold min-w-[280px]">
                            Tipos de Proposta Extraídos ({'|'})
                          </TableHead>
                          <TableHead className="text-xs font-bold w-24 text-center">
                            Total Tipos
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parseResult.previewRows.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center py-6 text-xs text-muted-foreground"
                            >
                              Nenhum registro encontrado no arquivo.
                            </TableCell>
                          </TableRow>
                        ) : (
                          parseResult.previewRows.map((row) => (
                            <TableRow
                              key={row.lineNumber}
                              className="hover:bg-white/80 transition-colors"
                            >
                              <TableCell className="text-xs font-mono text-muted-foreground font-semibold">
                                #{row.lineNumber}
                              </TableCell>
                              <TableCell className="text-xs font-medium max-w-[280px]">
                                <span className="text-slate-900 font-semibold block">
                                  {row.versaoNome || row.versaoIdentificador || '—'}
                                </span>
                                {row.codErp && (
                                  <span className="text-[11px] font-mono text-muted-foreground block">
                                    Cód. ERP: {row.codErp}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {row.tiposPropostaList.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {row.tiposPropostaList.map((tipo, tIdx) => (
                                      <Badge
                                        key={tIdx}
                                        variant="secondary"
                                        className="text-[11px] font-normal py-0.5 px-2 bg-emerald-50 text-emerald-800 border border-emerald-200"
                                      >
                                        {tipo}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground italic text-xs">
                                    Nenhum tipo de proposta listado
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-center font-mono font-semibold text-[#0b3c26]">
                                {row.tiposPropostaList.length}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Import Execution & Options */}
              <Card className="shadow-sm border-[#0b3c26]/30">
                <CardHeader className="pb-3 border-b bg-slate-50/50">
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#0b3c26]" />
                    Execução do Processamento
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Os vínculos serão criados na tabela <code>versao_tipos_proposta</code>. Vínculos
                    já existentes serão preservados sem duplicidade.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* In-progress state with real steps */}
                  {importing && (
                    <div className="space-y-3 bg-[#f0f7f3] p-5 rounded-xl border border-[#0b3c26]/20">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center text-xs text-[#0b3c26] font-semibold gap-1">
                        <span className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-[#0b3c26]" />
                          {progressStage || 'Processando importação...'}
                        </span>
                        <span className="font-mono">
                          {progressPct}% ({progressCurrent} de {progressTotal})
                        </span>
                      </div>
                      <Progress value={progressPct} className="h-3 bg-[#0b3c26]/10" />
                      <p className="text-[11px] text-[#0b3c26]/80 italic">
                        Consultando versões e tipos de proposta no Supabase, validando
                        correspondências e gravando associações em lotes...
                      </p>
                    </div>
                  )}

                  {/* Final Report Card */}
                  {report && (
                    <div className="space-y-5">
                      {/* Summary Metric Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                          <span className="text-[11px] text-slate-600 font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                            <FileCheck className="w-3.5 h-3.5" /> Versões Processadas
                          </span>
                          <p className="text-2xl font-extrabold text-slate-900 mt-1">
                            {report.totalVersoesProcessadas}
                          </p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                          <span className="text-[11px] text-emerald-700 font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                            <Link2 className="w-3.5 h-3.5" /> Vínculos Criados
                          </span>
                          <p className="text-2xl font-extrabold text-emerald-800 mt-1">
                            {report.totalAssociacoesCriadas}
                          </p>
                          <div className="text-[10px] text-emerald-700 mt-1 flex justify-center gap-2">
                            <span>ERP: {report.vinculosPorCodErp}</span>
                            <span>Nome: {report.vinculosPorNome}</span>
                          </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                          <span className="text-[11px] text-blue-700 font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Já Existentes (Ignoradas)
                          </span>
                          <p className="text-2xl font-extrabold text-blue-800 mt-1">
                            {report.totalAssociacoesIgnoradas}
                          </p>
                        </div>
                        <div
                          className={`rounded-xl p-3 text-center border ${
                            report.pendencias.length > 0
                              ? 'bg-rose-50 border-rose-300'
                              : 'bg-emerald-50 border-emerald-200'
                          }`}
                        >
                          <span
                            className={`text-[11px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1 ${
                              report.pendencias.length > 0 ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            <AlertCircle className="w-3.5 h-3.5" /> Pendências
                          </span>
                          <p
                            className={`text-2xl font-extrabold mt-1 ${
                              report.pendencias.length > 0 ? 'text-rose-800' : 'text-emerald-800'
                            }`}
                          >
                            {report.pendencias.length}
                          </p>
                        </div>
                      </div>

                      {/* Success Alert */}
                      {report.pendencias.length === 0 &&
                      (!report.errosGerais || report.errosGerais.length === 0) ? (
                        <Alert className="bg-emerald-50 border-emerald-300 text-emerald-900">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          <AlertTitle className="font-bold text-sm">
                            Processamento concluído com 100% de sucesso!
                          </AlertTitle>
                          <AlertDescription className="text-xs mt-1 text-emerald-800 leading-relaxed">
                            Foram processadas{' '}
                            <strong>{report.totalVersoesProcessadas} versões</strong> e criados{' '}
                            <strong>{report.totalAssociacoesCriadas} novos vínculos</strong> na
                            tabela <code>versao_tipos_proposta</code> ({report.vinculosPorCodErp}{' '}
                            por código ERP e {report.vinculosPorNome} por nome).{' '}
                            {report.totalAssociacoesIgnoradas} vínculos já existiam e foram
                            mantidos.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Alert
                          variant="destructive"
                          className="border-amber-400 bg-amber-50/80 text-amber-900"
                        >
                          <AlertTriangle className="h-5 w-5 text-amber-600" />
                          <AlertTitle className="font-bold text-sm text-amber-900">
                            Importação finalizada com pendências
                          </AlertTitle>
                          <AlertDescription className="text-xs mt-1 leading-relaxed space-y-1 text-amber-800">
                            <p>
                              <strong>{report.totalAssociacoesCriadas}</strong> novos vínculos foram
                              criados com sucesso ({report.vinculosPorCodErp} por cód. ERP,{' '}
                              {report.vinculosPorNome} por nome) e{' '}
                              <strong>{report.totalAssociacoesIgnoradas}</strong> vínculos já
                              existiam. No entanto, foram identificadas{' '}
                              <strong>{report.pendencias.length} pendência(s)</strong> (versões ou
                              tipos de proposta não localizados).
                            </p>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Pending items table */}
                      {report.pendencias.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4 text-rose-600" />
                              Lista de Pendências ({report.pendencias.length})
                            </h4>
                            <Badge
                              variant="outline"
                              className="text-xs border-rose-300 text-rose-800"
                            >
                              Linhas originais do arquivo
                            </Badge>
                          </div>

                          <div className="border border-rose-200 rounded-lg overflow-x-auto max-h-72 overflow-y-auto bg-rose-50/30">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-rose-100/60">
                                  <TableHead className="text-xs font-bold w-16 text-rose-950">
                                    Linha
                                  </TableHead>
                                  <TableHead className="text-xs font-bold text-rose-950">
                                    Identificador da Versão
                                  </TableHead>
                                  <TableHead className="text-xs font-bold text-rose-950">
                                    Tipo de Proposta
                                  </TableHead>
                                  <TableHead className="text-xs font-bold text-rose-950">
                                    Motivo
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {report.pendencias.map((pend, pIdx) => (
                                  <TableRow key={pIdx} className="hover:bg-rose-100/40">
                                    <TableCell className="text-xs font-mono font-bold text-rose-900">
                                      #{pend.lineNumber}
                                    </TableCell>
                                    <TableCell className="text-xs font-semibold text-slate-900">
                                      {pend.identificadorVersao}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {pend.tipoPropostaItem ? (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] bg-white text-slate-700"
                                        >
                                          {pend.tipoPropostaItem}
                                        </Badge>
                                      ) : (
                                        '—'
                                      )}
                                    </TableCell>
                                    <TableCell className="text-xs text-rose-700 font-medium">
                                      {pend.motivo}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      {/* General Errors */}
                      {report.errosGerais && report.errosGerais.length > 0 && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle className="text-xs font-bold">Erros registrados:</AlertTitle>
                          <AlertDescription className="text-xs font-mono space-y-1 mt-1">
                            {report.errosGerais.map((err, errIdx) => (
                              <div key={errIdx}>{err}</div>
                            ))}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-muted-foreground">
                      {parseResult.totalRows > 0 ? (
                        <span>
                          Pronto para processar <strong>{parseResult.totalRows} registros</strong>{' '}
                          do arquivo.
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        onClick={handleReset}
                        disabled={importing}
                        className="flex-1 sm:flex-initial"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleStartImport}
                        disabled={importing || parseResult.totalRows === 0 || !!report}
                        className="flex-1 sm:flex-initial bg-[#0b3c26] hover:bg-[#082e1d] text-white gap-2 font-semibold px-6 shadow-sm"
                      >
                        {importing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> Processando...
                          </>
                        ) : report ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" /> Importação Finalizada
                          </>
                        ) : (
                          <>
                            Processar Importação <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
