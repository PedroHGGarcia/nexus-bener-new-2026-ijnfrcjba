import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
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
  Layers,
  FileText,
  AlertCircle,
  Sparkles,
  FileCheck,
  PackagePlus,
  RefreshCcw,
  Tag,
  Factory,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import {
  parseProdutosImportFile,
  processarImportacaoProdutos,
  type ParsedProdutosSpreadsheetResult,
  type ProdutoImportReport,
} from '@/lib/produtos-importer'

export default function ImportarProdutosPage() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParsedProdutosSpreadsheetResult | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string>('')

  // Execution state
  const [importing, setImporting] = useState(false)
  const [progressStage, setProgressStage] = useState<string>('')
  const [progressPct, setProgressPct] = useState<number>(0)
  const [progressCurrent, setProgressCurrent] = useState<number>(0)
  const [progressTotal, setProgressTotal] = useState<number>(0)

  // Results
  const [report, setReport] = useState<ProdutoImportReport | null>(null)

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
      const result = await parseProdutosImportFile(selectedFile, targetSheet)
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
        description: 'Carregue um arquivo válido com dados de produtos.',
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
      const res = await processarImportacaoProdutos(parseResult.allRows, {
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
                setProgressStage('Carregando produtos existentes...')
                break
              case 'processando':
                setProgressStage(`Processando e atualizando produtos (${p.current}/${p.total})...`)
                break
              case 'salvando':
                setProgressStage(`Gravando produtos no banco (${p.current}/${p.total})...`)
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
            (p) => `Linha ${p.lineNumber} - Produto "${p.identificador}": ${p.motivo}`,
          ),
          ...(res.errosGerais || []),
        ]

        const totalSucessos = res.produtosCriados + res.produtosAtualizados

        await supabase.from('historico_importacoes').insert({
          tipo: 'Importação e Atualização de Produtos',
          arquivo: file?.name || 'produtos_importacao.csv',
          status: errorList.length === 0 ? 'Concluído' : totalSucessos > 0 ? 'Parcial' : 'Falha',
          registros_importados: totalSucessos,
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
          description: `${res.produtosCriados} produtos criados, ${res.produtosAtualizados} produtos atualizados e ${res.produtosSemAlteracao} sem alteração.`,
        })
      } else {
        toast({
          title: 'Importação finalizada com observações',
          description: `${res.produtosCriados} criados, ${res.produtosAtualizados} atualizados, ${res.produtosSemAlteracao} sem alteração, ${res.pendencias.length} pendência(s).`,
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
            <div className="p-2 rounded-lg bg-[#0b3c26]/10 text-[#0b3c26]">
              <PackagePlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0b3c26]">
                Importar e Atualizar Produtos
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Alimente o nível &quot;Produto&quot; da Gestão de Máquinas via arquivo CSV ou Excel
                (colunas: reg, cod, nome, status, modelo, categoria, fabricante).
              </p>
            </div>
          </div>
        </div>
        {file && (
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

      {/* Info Banner explicativo */}
      <Alert className="bg-[#f0f7f3] border-[#0b3c26]/20 text-[#0b3c26]">
        <Info className="h-4 w-4 text-[#0b3c26]" />
        <AlertTitle className="font-semibold text-sm">
          Como funciona a importação e atualização de Produtos
        </AlertTitle>
        <AlertDescription className="text-xs text-[#0b3c26]/90 mt-1 leading-relaxed space-y-1">
          <p>
            O arquivo é processado linha a linha. Para cada registro, o sistema localiza o produto
            na tabela <code>produtos</code> buscando primeiro por <code>reg</code> (numérico único),
            depois por <code>cod</code> e, por fim, por <code>nome</code> (com tolerância a acentos
            e caixa).
          </p>
          <p>
            <strong>Se o produto JÁ EXISTE:</strong> Os dados presentes no arquivo são{' '}
            <strong>atualizados</strong>. Campos vazios no arquivo <em>não sobrescrevem</em> dados
            já existentes no banco.
          </p>
          <p>
            <strong>Se o produto NÃO existe:</strong> É <strong>criado</strong> com todos os dados
            fornecidos (reg, cod, nome, status, modelo, categoria e fabricante).
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
                dragOver ? 'bg-[#0b3c26]/10 border-[#0b3c26] scale-[0.99]' : 'hover:bg-[#0b3c26]/5'
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
                Arraste sua planilha de Produtos (CSV ou XLSX) aqui
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 text-center max-w-lg leading-relaxed">
                ou clique para selecionar do seu dispositivo. Suporta arquivos com as colunas:{' '}
                <code>reg</code>, <code>cod</code>, <code>nome</code>, <code>status</code>,{' '}
                <code>modelo</code>, <code>categoria</code> e <code>fabricante</code>.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <RefreshCcw className="w-3.5 h-3.5 text-[#0b3c26]" /> Atualiza Existentes
                </Badge>
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <Tag className="w-3.5 h-3.5 text-[#0b3c26]" /> Identificação por Reg / Cód
                </Badge>
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <FileText className="w-3.5 h-3.5 text-[#0b3c26]" /> CSV (.csv)
                </Badge>
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#0b3c26]" /> Excel (.xlsx, .xls)
                </Badge>
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <Layers className="w-3.5 h-3.5 text-[#0b3c26]" /> Categoria &amp; Fabricante
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
              Lendo e estruturando os dados do arquivo de produtos...
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
                        Importação de Produtos
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Tamanho: {(file.size / 1024).toFixed(1)} KB &bull; Total identificado:{' '}
                      <strong className="text-slate-800">{parseResult.totalRows} produtos</strong>
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
                    Confira o mapeamento das colunas (reg, cod, nome, categoria, fabricante, status)
                    antes de processar.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  Mostrando {Math.min(5, parseResult.totalRows)} de {parseResult.totalRows} linhas
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="border rounded-lg overflow-x-auto bg-slate-50/50">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="text-xs font-bold w-16">Linha</TableHead>
                      <TableHead className="text-xs font-bold w-20">Reg</TableHead>
                      <TableHead className="text-xs font-bold w-24">Cód</TableHead>
                      <TableHead className="text-xs font-bold min-w-[260px]">
                        Nome do Produto
                      </TableHead>
                      <TableHead className="text-xs font-bold min-w-[140px]">Categoria</TableHead>
                      <TableHead className="text-xs font-bold min-w-[140px]">Fabricante</TableHead>
                      <TableHead className="text-xs font-bold w-24 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseResult.previewRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
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
                          <TableCell className="text-xs font-mono font-bold text-[#0b3c26]">
                            {row.reg !== null && row.reg !== undefined ? row.reg : '—'}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {row.cod || '—'}
                          </TableCell>
                          <TableCell className="text-xs font-medium max-w-[280px]">
                            <span className="text-slate-900 font-semibold block">
                              {row.nome || '—'}
                            </span>
                            {row.modelo && (
                              <span className="text-[11px] text-muted-foreground block">
                                Modelo: {row.modelo}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700">
                            {row.categoria ? (
                              <Badge variant="outline" className="text-[10px] bg-white">
                                {row.categoria}
                              </Badge>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700">
                            {row.fabricante ? (
                              <span className="flex items-center gap-1">
                                <Factory className="w-3 h-3 text-muted-foreground" />
                                {row.fabricante}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            <Badge
                              variant="secondary"
                              className={
                                row.status === 'Ativo'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }
                            >
                              {row.status || 'Ativo'}
                            </Badge>
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
                Execução da Importação
              </CardTitle>
              <CardDescription className="text-xs">
                Os dados serão gravados na tabela <code>produtos</code>. Se já existir por{' '}
                <code>reg</code>, <code>cod</code> ou <code>nome</code>, o registro será atualizado
                preservando campos vazios.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* In-progress state with progress bar */}
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
                    Consultando produtos no Supabase, cruzando IDs por reg/cod/nome e atualizando
                    registros...
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
                        <FileCheck className="w-3.5 h-3.5" /> Total Processado
                      </span>
                      <p className="text-2xl font-extrabold text-slate-900 mt-1">
                        {report.totalLinhasProcessadas}
                      </p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                      <span className="text-[11px] text-emerald-700 font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                        <PackagePlus className="w-3.5 h-3.5" /> Criados
                      </span>
                      <p className="text-2xl font-extrabold text-emerald-800 mt-1">
                        {report.produtosCriados}
                      </p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                      <span className="text-[11px] text-blue-700 font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                        <RefreshCcw className="w-3.5 h-3.5" /> Atualizados
                      </span>
                      <p className="text-2xl font-extrabold text-blue-800 mt-1">
                        {report.produtosAtualizados}
                      </p>
                      <div className="text-[10px] text-blue-700 mt-0.5">
                        {report.produtosSemAlteracao} sem alteração
                      </div>
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
                        Processamento concluído com sucesso!
                      </AlertTitle>
                      <AlertDescription className="text-xs mt-1 text-emerald-800 leading-relaxed">
                        Foram processados <strong>{report.totalLinhasProcessadas} registros</strong>
                        : <strong>{report.produtosCriados} produtos novos criados</strong>,{' '}
                        <strong>{report.produtosAtualizados} produtos atualizados</strong> e{' '}
                        {report.produtosSemAlteracao} sem alteração necessária.
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
                          <strong>{report.produtosCriados}</strong> criados,{' '}
                          <strong>{report.produtosAtualizados}</strong> atualizados e{' '}
                          <strong>{report.produtosSemAlteracao}</strong> sem alteração. Foram
                          identificadas <strong>{report.pendencias.length} pendência(s)</strong>.
                        </p>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Pending items table with line number */}
                  {report.pendencias.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          Lista de Pendências com Nº da Linha ({report.pendencias.length})
                        </h4>
                        <Badge variant="outline" className="text-xs border-rose-300 text-rose-800">
                          Linhas do arquivo
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
                                Identificador do Produto
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
                                  {pend.identificador}
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
                      Pronto para processar <strong>{parseResult.totalRows} registros</strong> do
                      arquivo.
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
    </div>
  )
}
