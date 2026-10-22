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
  RefreshCcw,
  Users,
  MapPin,
  Building2,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import {
  parseRepresentantesImportFile,
  processarImportacaoRepresentantes,
  type ParsedRepresentantesSpreadsheetResult,
  type RepresentanteImportReport,
} from '@/lib/representantes-importer'

export default function ImportarRepresentantesPage() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParsedRepresentantesSpreadsheetResult | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string>('')

  // Execution state
  const [importing, setImporting] = useState(false)
  const [progressStage, setProgressStage] = useState<string>('')
  const [progressPct, setProgressPct] = useState<number>(0)
  const [progressCurrent, setProgressCurrent] = useState<number>(0)
  const [progressTotal, setProgressTotal] = useState<number>(0)

  // Results
  const [report, setReport] = useState<RepresentanteImportReport | null>(null)

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
      const result = await parseRepresentantesImportFile(selectedFile, targetSheet)
      setParseResult(result)
      if (result.sheetName) {
        setSelectedSheet(result.sheetName)
      }
      toast({
        title: 'Arquivo carregado com sucesso!',
        description: `${result.totalRows} representantes identificados no arquivo.`,
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
        description: 'Carregue um arquivo válido com dados de representantes.',
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
      const res = await processarImportacaoRepresentantes(parseResult.allRows, {
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
                setProgressStage('Carregando representantes, categorias e regiões existentes...')
                break
              case 'processando':
                setProgressStage(
                  `Processando e vinculando representantes (${p.current}/${p.total})...`,
                )
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
              `Linha ${p.lineNumber} - [${p.tipo.toUpperCase()}] ${p.identificador}: ${p.motivo}`,
          ),
          ...(res.errosGerais || []),
        ]

        const totalSucessos = res.representantesCriados + res.representantesAtualizados

        await supabase.from('historico_importacoes').insert({
          tipo: 'Importação e Atualização de Representantes',
          arquivo: file?.name || 'representantes_importacao.csv',
          status: errorList.length === 0 ? 'Concluído' : totalSucessos > 0 ? 'Parcial' : 'Falha',
          registros_importados: totalSucessos,
          registros_erro: res.pendencias.filter((p) => p.tipo === 'erro').length,
          erros: errorList.length > 0 ? errorList : null,
          usuario: user?.email || 'Admin',
        })
      } catch (auditErr) {
        console.warn('Erro ao registrar histórico de importação:', auditErr)
      }

      const totalErros = res.pendencias.filter((p) => p.tipo === 'erro').length

      if (totalErros === 0 && (!res.errosGerais || res.errosGerais.length === 0)) {
        toast({
          title: 'Importação concluída com sucesso!',
          description: `${res.representantesCriados} representantes criados, ${res.representantesAtualizados} atualizados, ${res.vinculosCategoriasCriados} vínculos de categoria e ${res.vinculosRegioesCriados} vínculos de região.`,
        })
      } else {
        toast({
          title: 'Importação finalizada com observações',
          description: `${res.representantesCriados} criados, ${res.representantesAtualizados} atualizados, ${res.representantesSemAlteracao} sem alteração, ${totalErros} pendência(s).`,
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
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0b3c26]">
                Importar e Atualizar Representantes
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Alimente a base de representantes comerciais via arquivo CSV ou Excel com vínculo
                automático a categorias de produtos e regiões/estados de atuação.
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
          Como funciona a importação e vinculação de Representantes
        </AlertTitle>
        <AlertDescription className="text-xs text-[#0b3c26]/90 mt-1 leading-relaxed space-y-1">
          <p>
            O arquivo é processado linha a linha. Para cada registro, o sistema localiza o
            representante buscando na ordem: 1º por <code>reg</code>, 2º por <code>cod</code> e 3º
            por <code>razao_social</code> (com matching tolerante a acentos e
            maiúsculas/minúsculas).
          </p>
          <p>
            <strong>Atualização Não-Destrutiva:</strong> Se o representante já existe, os dados do
            arquivo são atualizados. Campos vazios no arquivo <em>nunca sobrescrevem nem apagam</em>{' '}
            dados pré-existentes no sistema.
          </p>
          <p>
            <strong>Resolução de Categorias:</strong> A coluna <code>categorias</code> traz itens
            separados por <code>|</code>. Cada categoria é vinculada à tabela oficial de categorias
            de produtos sem duplicar. Categorias não encontradas são registradas como pendência na
            linha.
          </p>
          <p>
            <strong>Resolução de Regiões de Atuação:</strong> A coluna <code>regioes</code> traz
            estados separados por <code>|</code> (resolvidos contra a tabela oficial dos 26 estados
            + DF). Se o arquivo trouxer &quot;BRASIL&quot; acompanhado de estados, o item
            &quot;BRASIL&quot; é ignorado e os estados reais são vinculados. Se houver apenas
            &quot;BRASIL&quot;, é interpretado como atuação nacional (sem vínculo de estado
            restritivo).
          </p>
          <p>
            <strong>Tratamento de Status:</strong> &quot;Ativo&quot; e &quot;Inativo&quot; são
            reconhecidos diretamente. Valores ambíguos (ex: &quot;Status&quot; ou vazio) são
            tratados como ativos e registrados como aviso no relatório.
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
                Arraste sua planilha de Representantes (CSV ou XLSX) aqui
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 text-center max-w-lg leading-relaxed">
                ou clique para selecionar do seu dispositivo. Suporta arquivos com colunas:{' '}
                <code>reg</code>, <code>cod</code>, <code>cpf_cnpj</code>, <code>razao_social</code>
                , <code>nome_fantasia</code>, <code>email</code>, <code>telefone</code>,{' '}
                <code>celular</code>, <code>cidade</code>, <code>uf</code>, <code>bairro</code>,{' '}
                <code>endereco</code>, <code>status</code>, <code>categorias</code> e{' '}
                <code>regioes</code>.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <RefreshCcw className="w-3.5 h-3.5 text-[#0b3c26]" /> Atualiza Existentes
                </Badge>
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <Building2 className="w-3.5 h-3.5 text-[#0b3c26]" /> Cria Faltantes
                </Badge>
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <Layers className="w-3.5 h-3.5 text-[#0b3c26]" /> Vínculo Categorias (|)
                </Badge>
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <MapPin className="w-3.5 h-3.5 text-[#0b3c26]" /> Vínculo Regiões/Estados (|)
                </Badge>
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <FileText className="w-3.5 h-3.5 text-[#0b3c26]" /> CSV (.csv com vírgula ou ;)
                </Badge>
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#0b3c26]" /> Excel (.xlsx, .xls)
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
              Lendo e estruturando os dados do arquivo de representantes...
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
                        Importação de Representantes
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Tamanho: {(file.size / 1024).toFixed(1)} KB &bull; Total identificado:{' '}
                      <strong className="text-slate-800">
                        {parseResult.totalRows} representantes
                      </strong>
                    </CardDescription>
                  </div>
                </div>

                {/* Sheet Selector if multiple sheets exist in XLSX */}
                {parseResult.availableSheets && parseResult.availableSheets.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">Aba:</span>
                    <Select value={selectedSheet} onValueChange={handleSheetChange}>
                      <SelectTrigger className="h-8 w-44 text-xs bg-white border-slate-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {parseResult.availableSheets.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Preview Table */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="py-4 px-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-[#0b3c26]" /> Prévia das Primeiras Linhas
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Mostrando as primeiras {parseResult.previewRows.length} linhas detectadas do
                    arquivo
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs bg-white text-slate-600">
                  Total: {parseResult.totalRows} linhas
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-12 text-center text-xs">#</TableHead>
                      <TableHead className="text-xs">Reg</TableHead>
                      <TableHead className="text-xs">Cód</TableHead>
                      <TableHead className="text-xs">Nome Fantasia / Razão Social</TableHead>
                      <TableHead className="text-xs">Cidade / UF</TableHead>
                      <TableHead className="text-xs">E-mail</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Categorias</TableHead>
                      <TableHead className="text-xs">Regiões</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseResult.previewRows.map((r, i) => (
                      <TableRow key={i} className="text-xs">
                        <TableCell className="text-center font-mono text-muted-foreground">
                          {r.lineNumber}
                        </TableCell>
                        <TableCell className="font-mono text-slate-700">{r.reg ?? '—'}</TableCell>
                        <TableCell className="font-mono text-slate-600">{r.cod || '—'}</TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">
                            {r.nome_fantasia || r.razao_social || '—'}
                          </div>
                          {r.razao_social &&
                            r.nome_fantasia &&
                            r.razao_social !== r.nome_fantasia && (
                              <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                                {r.razao_social}
                              </div>
                            )}
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {r.cidade ? `${r.cidade}/${r.uf || ''}` : r.uf || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[180px]">
                          {r.email || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={r.statusResolved === 'Ativo' ? 'default' : 'secondary'}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {r.statusResolved}
                          </Badge>
                          {r.statusWarning && (
                            <span className="block text-[10px] text-amber-600 mt-0.5">
                              (ajustado)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {r.categoriasRaw ? (
                            <div className="flex flex-wrap gap-1">
                              {r.categoriasRaw
                                .split('|')
                                .slice(0, 3)
                                .map((c, ci) => (
                                  <Badge
                                    key={ci}
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 bg-slate-50"
                                  >
                                    {c.trim()}
                                  </Badge>
                                ))}
                              {r.categoriasRaw.split('|').length > 3 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{r.categoriasRaw.split('|').length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {r.regioesRaw ? (
                            <div className="flex flex-wrap gap-1">
                              {r.regioesRaw
                                .split('|')
                                .slice(0, 3)
                                .map((reg, ri) => (
                                  <Badge
                                    key={ri}
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 bg-emerald-50 text-emerald-800 border-emerald-200"
                                  >
                                    {reg.trim()}
                                  </Badge>
                                ))}
                              {r.regioesRaw.split('|').length > 3 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{r.regioesRaw.split('|').length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Action Execution Button */}
          {!importing && !report && (
            <Card className="border-[#0b3c26]/20 bg-[#0b3c26]/5 shadow-sm">
              <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-sm font-bold text-[#0b3c26] flex items-center gap-2 justify-center sm:justify-start">
                    <Sparkles className="w-4 h-4 text-[#0b3c26]" /> Tudo pronto para processar a
                    base
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Clique no botão ao lado para iniciar a criação e atualização dos representantes
                    e vinculação automática às categorias e regiões de atuação.
                  </p>
                </div>
                <Button
                  onClick={handleStartImport}
                  className="bg-[#0b3c26] hover:bg-[#082a1b] text-white gap-2 px-6 h-11 shrink-0 shadow-md transition-all font-semibold"
                >
                  Processar e Importar {parseResult.totalRows} Representantes
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Progress Bar */}
          {importing && (
            <Card className="border shadow-md bg-white">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#0b3c26]" />
                    <span>{progressStage || 'Importando dados...'}</span>
                  </div>
                  <span className="font-mono text-muted-foreground">
                    {progressCurrent} / {progressTotal} ({progressPct}%)
                  </span>
                </div>
                <Progress value={progressPct} className="h-2.5 bg-slate-100" />
                <p className="text-[11px] text-muted-foreground text-center">
                  Não feche esta página enquanto o processamento estiver em andamento.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Final Report */}
          {report && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <Card className="border-emerald-200 bg-white shadow-sm overflow-hidden">
                <CardHeader className="bg-[#f0f7f3] border-b border-emerald-100 py-4 px-6">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-full bg-emerald-600 text-white">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">
                        Relatório da Importação de Representantes
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Resumo do processamento e enriquecimento da base
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-center">
                      <div className="text-xs text-muted-foreground font-medium">Processados</div>
                      <div className="text-2xl font-bold text-slate-900 mt-1">
                        {report.totalLinhasProcessadas}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-center">
                      <div className="text-xs text-emerald-700 font-medium">Criados</div>
                      <div className="text-2xl font-bold text-emerald-700 mt-1">
                        {report.representantesCriados}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg border border-blue-200 bg-blue-50 text-center">
                      <div className="text-xs text-blue-700 font-medium">Atualizados</div>
                      <div className="text-2xl font-bold text-blue-700 mt-1">
                        {report.representantesAtualizados}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-center">
                      <div className="text-xs text-slate-600 font-medium">Sem Alteração</div>
                      <div className="text-2xl font-bold text-slate-700 mt-1">
                        {report.representantesSemAlteracao}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg border border-purple-200 bg-purple-50 text-center">
                      <div className="text-xs text-purple-700 font-medium">Vínculos Categorias</div>
                      <div className="text-2xl font-bold text-purple-700 mt-1">
                        {report.vinculosCategoriasCriados}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg border border-teal-200 bg-teal-50 text-center">
                      <div className="text-xs text-teal-700 font-medium">Vínculos Regiões</div>
                      <div className="text-2xl font-bold text-teal-700 mt-1">
                        {report.vinculosRegioesCriados}
                      </div>
                    </div>
                  </div>

                  {/* General Errors if any */}
                  {report.errosGerais && report.errosGerais.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Erros Gerais Detectados</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                          {report.errosGerais.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Pendencies / Warnings Table */}
                  {report.pendencias.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <h4 className="text-sm font-bold text-slate-900">
                            Observações e Pendências Identificadas ({report.pendencias.length})
                          </h4>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {report.pendencias.filter((p) => p.tipo === 'erro').length} pendência(s) /{' '}
                          {report.pendencias.filter((p) => p.tipo === 'aviso').length} aviso(s)
                        </span>
                      </div>
                      <div className="border rounded-lg max-h-72 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="w-16 text-center text-xs">Linha</TableHead>
                              <TableHead className="w-24 text-xs">Tipo</TableHead>
                              <TableHead className="w-48 text-xs">Representante</TableHead>
                              <TableHead className="text-xs">Motivo / Detalhes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {report.pendencias.map((pend, i) => (
                              <TableRow key={i} className="text-xs">
                                <TableCell className="text-center font-mono text-muted-foreground">
                                  {pend.lineNumber}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={pend.tipo === 'erro' ? 'destructive' : 'outline'}
                                    className={`text-[10px] px-1.5 py-0 ${
                                      pend.tipo === 'aviso'
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : ''
                                    }`}
                                  >
                                    {pend.tipo === 'erro' ? 'Pendência' : 'Aviso'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-semibold text-slate-800">
                                  {pend.identificador}
                                </TableCell>
                                <TableCell className="text-slate-600">{pend.motivo}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                      <p className="text-xs font-semibold text-emerald-800">
                        Nenhuma pendência encontrada! Todos os registros foram processados
                        perfeitamente.
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                    <Button
                      variant="outline"
                      onClick={() => (window.location.href = '/cadastros/representantes')}
                      className="text-xs gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" /> Ir para Cadastro de Representantes
                    </Button>
                    <Button
                      onClick={handleReset}
                      className="bg-[#0b3c26] text-white text-xs gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Importar Outro Arquivo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
