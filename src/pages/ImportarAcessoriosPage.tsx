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
import { Checkbox } from '@/components/ui/checkbox'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Info,
  Link2,
  PackageCheck,
  FileText,
  AlertCircle,
  Sparkles,
  Edit,
  Fingerprint,
  Layers,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import {
  parseAccessoriesImportFile,
  processarImportacao,
  type ParsedSpreadsheetResult,
  type ImportReport,
} from '@/lib/acessorios-importer'
import { formatCurrencyByMoeda } from '@/lib/format'

export default function ImportarAcessoriosPage() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParsedSpreadsheetResult | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string>('')

  // Processing configuration (Default: true as required to automatically create missing accessories)
  const [criarAcessoriosNovos, setCriarAcessoriosNovos] = useState(true)

  // Execution state
  const [importing, setImporting] = useState(false)
  const [progressStage, setProgressStage] = useState<string>('')
  const [progressPct, setProgressPct] = useState<number>(0)
  const [progressCurrent, setProgressCurrent] = useState<number>(0)
  const [progressTotal, setProgressTotal] = useState<number>(0)

  // Results
  const [report, setReport] = useState<ImportReport | null>(null)

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
      const result = await parseAccessoriesImportFile(selectedFile, targetSheet)
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
        description: 'Carregue um arquivo válido com dados de versões e acessórios.',
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
      const res = await processarImportacao(parseResult.allRows, {
        criarAcessoriosNaoEncontrados: criarAcessoriosNovos,
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
                setProgressStage('Carregando cadastro de versões e acessórios...')
                break
              case 'processando_acessorios':
                setProgressStage(`Atualizando e criando acessórios (${p.current}/${p.total})...`)
                break
              case 'criando_acessorios':
                setProgressStage('Cadastrando acessórios inexistentes no banco...')
                break
              case 'processando':
                setProgressStage(`Analisando e vinculando (${p.current}/${p.total})...`)
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
              `Linha ${p.lineNumber} - Versão "${p.versaoNome}"${p.versaoId ? ` (ID: ${p.versaoId})` : ''}: ${p.motivo}`,
          ),
          ...(res.pendenciasAcessorios?.map(
            (a) =>
              `Linha ${a.lineNumber} - Versão "${a.versaoNome}" - Acessório "${a.acessorioNome}": ${a.motivo}`,
          ) || []),
          ...(res.errosGerais || []),
        ]

        await supabase.from('historico_importacoes').insert({
          tipo: 'Vínculos de Acessórios (Planilha / CSV)',
          arquivo: file?.name || 'acessorios.csv',
          status:
            errorList.length === 0 ? 'Concluído' : res.associacoesCriadas > 0 ? 'Parcial' : 'Falha',
          registros_importados:
            res.associacoesCriadas +
            (res.acessoriosCriados || 0) +
            (res.acessoriosAtualizados || 0),
          registros_erro: res.pendencias.length + (res.pendenciasAcessorios?.length || 0),
          erros: errorList.length > 0 ? errorList : null,
          usuario: user?.email || 'Admin',
        })
      } catch (auditErr) {
        console.warn('Erro ao registrar histórico de importação:', auditErr)
      }

      const totalModificados = (res.acessoriosCriados || 0) + (res.acessoriosAtualizados || 0)

      if (res.pendencias.length === 0 && (!res.errosGerais || res.errosGerais.length === 0)) {
        toast({
          title: 'Importação concluída!',
          description: `${res.associacoesCriadas} novos vínculos criados (${res.vinculosPorIdDireto} por ID direto, ${res.vinculosPorNomeFallback} por nome), ${totalModificados} acessórios processados com sucesso.`,
        })
      } else {
        toast({
          title: 'Importação concluída com pendências',
          description: `${res.associacoesCriadas} vínculos criados, ${res.pendencias.length} versões não encontradas.`,
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
            <div className="p-2 rounded-lg bg-[#0b3c26]/10 text-[#0b3c26]">
              <Link2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0b3c26]">
                Importar Acessórios e Vínculos
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Importe e atualize acessórios (valores, tipo, fator, status) e vincule às versões de
                máquinas por <strong>ID Supabase</strong> ou <strong>nome</strong> via CSV ou XLSX.
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
          Como funciona o importador inteligente com suporte ao novo formato de CSV
        </AlertTitle>
        <AlertDescription className="text-xs text-[#0b3c26]/90 mt-1 leading-relaxed space-y-1">
          <p>
            Suporta o novo CSV com colunas <strong>Nome_Acessorio</strong>,{' '}
            <strong>Versao_Associada_Nome</strong>, <strong>Versao_ID_Supabase</strong>, status,
            tipo, moeda, valor e fator, além dos formatos padrão anteriores.
          </p>
          <p>
            <strong>Vínculo Direto por ID:</strong> Quando a coluna <code>Versao_ID_Supabase</code>{' '}
            estiver preenchida com o UUID da versão, o vínculo em <code>acessorio_versoes</code> é
            feito diretamente de forma rápida e precisa. Se o ID estiver vazio, o importador busca
            automaticamente por <code>Versao_Associada_Nome</code> (com tolerância a acentos e
            espaços).
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
                Arraste sua planilha CSV ou XLSX aqui
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 text-center max-w-lg leading-relaxed">
                ou clique para selecionar do seu dispositivo. Aceita novo CSV mapeado (
                <code>Nome_Acessorio, Versao_Associada_Nome, Versao_ID_Supabase...</code>) ou
                formato padrão/Excel.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <Fingerprint className="w-3.5 h-3.5 text-[#0b3c26]" /> Vínculo direto por
                  Versao_ID_Supabase
                </Badge>
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <FileText className="w-3.5 h-3.5 text-[#0b3c26]" /> CSV (Nome_Acessorio,
                  Versao_Associada_Nome, ...)
                </Badge>
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#0b3c26]" /> Excel (.xlsx, .xls)
                </Badge>
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <Layers className="w-3.5 h-3.5 text-[#0b3c26]" /> Múltiplas Versões por "|"
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
            <p className="text-sm font-semibold text-[#0b3c26]">Lendo e analisando o arquivo...</p>
          </div>
        </Card>
      )}

      {/* Step 2 & 3: File details, Preview, Options & Execution */}
      {file && !parsing && parseResult && (
        <div className="space-y-6">
          {/* File summary bar */}
          <Card className="shadow-sm border-[#0b3c26]/20 bg-gradient-to-r from-white via-white to-[#0b3c26]/5">
            <CardHeader className="py-4 px-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0b3c26] text-white flex items-center justify-center shrink-0">
                    {parseResult.isRichAcessorioFormat ? (
                      <FileText className="w-5 h-5" />
                    ) : (
                      <FileSpreadsheet className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                      {file.name}
                      {parseResult.isRichAcessorioFormat ? (
                        <Badge className="bg-[#0b3c26] text-white text-[11px] font-normal">
                          CSV / Tabela de Acessórios com Vínculos
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] font-normal">
                          Formato Versão / Acessórios
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Tamanho: {(file.size / 1024).toFixed(1)} KB &bull; Total identificado:{' '}
                      <strong className="text-slate-800">{parseResult.totalRows} registros</strong>
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
                    {parseResult.isRichAcessorioFormat
                      ? 'Exibição das colunas reconhecidas: Nome, Status, Versão Associada, ID Supabase, Tipo, Moeda, Valor e Fator.'
                      : 'Confira a extração da versão e dos acessórios vinculados antes de iniciar o processamento.'}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  Mostrando {Math.min(5, parseResult.totalRows)} de {parseResult.totalRows} linhas
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="border rounded-lg overflow-x-auto bg-slate-50/50">
                {parseResult.isRichAcessorioFormat ? (
                  // Rich CSV table with columns: Linha, Nome, Status, Versão, ID Supabase, Tipo, Moeda, Valor, Fator
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-100">
                        <TableHead className="text-xs font-bold w-14">Linha</TableHead>
                        <TableHead className="text-xs font-bold min-w-[200px]">
                          Nome do Acessório
                        </TableHead>
                        <TableHead className="text-xs font-bold w-20">Status</TableHead>
                        <TableHead className="text-xs font-bold min-w-[220px]">
                          Versão Associada
                        </TableHead>
                        <TableHead className="text-xs font-bold min-w-[170px]">
                          ID Supabase
                        </TableHead>
                        <TableHead className="text-xs font-bold w-24">Tipo</TableHead>
                        <TableHead className="text-xs font-bold w-16 text-center">Moeda</TableHead>
                        <TableHead className="text-xs font-bold w-24 text-right">Valor</TableHead>
                        <TableHead className="text-xs font-bold w-16 text-center">Fator</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parseResult.previewRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={9}
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
                            <TableCell className="text-xs font-medium max-w-[240px]">
                              <span className="text-slate-900 font-semibold block break-words">
                                {row.nome || row.acessoriosStr || '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${
                                  row.status?.toLowerCase() === 'ativo'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {row.status || 'Ativo'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.versoesList && row.versoesList.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-[300px]">
                                  {row.versoesList.map((v, vIdx) => (
                                    <Badge
                                      key={vIdx}
                                      variant="secondary"
                                      className="text-[11px] font-normal py-0.5 px-2 bg-emerald-50 text-emerald-800 border border-emerald-200 break-all"
                                    >
                                      {v}
                                    </Badge>
                                  ))}
                                </div>
                              ) : row.versaoNome ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[11px] font-normal py-0.5 px-2 bg-emerald-50 text-emerald-800 border border-emerald-200"
                                >
                                  {row.versaoNome}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground italic text-xs">
                                  Nenhuma versão associada
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {row.versaoIdsList && row.versaoIdsList.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {row.versaoIdsList.map((id, idIdx) => (
                                    <Badge
                                      key={idIdx}
                                      variant="outline"
                                      className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200 py-0 px-1.5"
                                      title={id}
                                    >
                                      {id.length > 13 ? `${id.slice(0, 8)}...` : id}
                                    </Badge>
                                  ))}
                                </div>
                              ) : row.versaoIdSupabase ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200 py-0 px-1.5"
                                  title={row.versaoIdSupabase}
                                >
                                  {row.versaoIdSupabase.length > 13
                                    ? `${row.versaoIdSupabase.slice(0, 8)}...`
                                    : row.versaoIdSupabase}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground italic text-[11px]">
                                  (Busca por nome)
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-slate-700">
                              {row.tipo ? (
                                <Badge
                                  variant="outline"
                                  className="text-[11px] bg-white font-normal"
                                >
                                  {row.tipo}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground italic text-[11px]">
                                  Geral
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-center font-mono font-semibold text-slate-800">
                              {row.moeda || 'BRL'}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono font-semibold text-emerald-700">
                              {formatCurrencyByMoeda(row.valor ?? 0, row.moeda || 'BRL')}
                            </TableCell>
                            <TableCell className="text-xs text-center font-mono text-slate-700">
                              {row.fator !== undefined ? Number(row.fator).toFixed(2) : '1.00'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  // Legacy/standard format table
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-100">
                        <TableHead className="text-xs font-bold w-16">Linha</TableHead>
                        <TableHead className="text-xs font-bold w-1/3">Nome da Versão</TableHead>
                        <TableHead className="text-xs font-bold">
                          Acessórios a Vincular ({'|'})
                        </TableHead>
                        <TableHead className="text-xs font-bold w-20 text-center">
                          Total Itens
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
                            Nenhuma linha com versão e acessórios encontrada nesta aba.
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
                              <span className="text-slate-900 font-semibold">
                                {row.versaoNome || '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.acessoriosList.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {row.acessoriosList.map((acc, accIdx) => (
                                    <Badge
                                      key={accIdx}
                                      variant="secondary"
                                      className="text-[11px] font-normal py-0 px-2 bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    >
                                      {acc}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic text-xs">
                                  Nenhum acessório listado
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-center font-mono font-semibold text-[#0b3c26]">
                              {row.acessoriosList.length}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Import Execution & Options */}
          <Card className="shadow-sm border-[#0b3c26]/30">
            <CardHeader className="pb-3 border-b bg-slate-50/50">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0b3c26]" />
                Opções e Execução do Processamento
              </CardTitle>
              <CardDescription className="text-xs">
                {parseResult.isRichAcessorioFormat
                  ? 'Os acessórios existentes serão atualizados e os novos cadastrados. Vínculos serão feitos diretamente por ID (quando informado) ou por nome da versão.'
                  : 'Configure se acessórios inexistentes devem ser cadastrados ou apenas reportados.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Option Checkbox */}
              <div className="flex items-start space-x-3 p-3.5 rounded-lg border bg-slate-50/70 border-slate-200">
                <Checkbox
                  id="criar-acessorios"
                  checked={criarAcessoriosNovos}
                  onCheckedChange={(c) => setCriarAcessoriosNovos(!!c)}
                  disabled={importing || !!report}
                />
                <div className="space-y-1 leading-none">
                  <label
                    htmlFor="criar-acessorios"
                    className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-2"
                  >
                    Cadastrar e atualizar automaticamente acessórios no banco
                    <Badge
                      variant="secondary"
                      className="text-[10px] py-0 px-1.5 bg-emerald-100 text-emerald-800 font-normal"
                    >
                      Recomendado
                    </Badge>
                  </label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {parseResult.isRichAcessorioFormat
                      ? 'Atualiza status, tipo, moeda, valor e fator dos acessórios já cadastrados, cria os novos e estabelece os vínculos com as versões usando ID ou nome.'
                      : 'Cria automaticamente os acessórios na tabela acessorios (sem duplicar) e vincula às versões correspondentes.'}{' '}
                    <strong>As versões nunca são criadas ou alteradas.</strong>
                  </p>
                </div>
              </div>

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
                    Consultando versões e acessórios no Supabase, vinculando por ID direto e
                    gravando associações em lotes...
                  </p>
                </div>
              )}

              {/* Final Report Card */}
              {report && (
                <div className="space-y-5">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                      <span className="text-[11px] text-purple-700 font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                        <PackageCheck className="w-3.5 h-3.5" /> Criados
                      </span>
                      <p className="text-2xl font-extrabold text-purple-900 mt-1">
                        {report.acessoriosCriados}
                      </p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                      <span className="text-[11px] text-amber-700 font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                        <Edit className="w-3.5 h-3.5" /> Atualizados
                      </span>
                      <p className="text-2xl font-extrabold text-amber-900 mt-1">
                        {report.acessoriosAtualizados || 0}
                      </p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                      <span className="text-[11px] text-emerald-700 font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                        <Link2 className="w-3.5 h-3.5" /> Vínculos Novos
                      </span>
                      <p className="text-2xl font-extrabold text-emerald-800 mt-1">
                        {report.associacoesCriadas}
                      </p>
                      <div className="text-[10px] text-emerald-700 mt-1 flex justify-center gap-2">
                        <span>ID: {report.vinculosPorIdDireto}</span>
                        <span>Nome: {report.vinculosPorNomeFallback}</span>
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                      <span className="text-[11px] text-blue-700 font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Já Existentes
                      </span>
                      <p className="text-2xl font-extrabold text-blue-800 mt-1">
                        {report.associacoesIgnoradas}
                      </p>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
                      <span className="text-[11px] text-indigo-700 font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                        <Fingerprint className="w-3.5 h-3.5" /> Vínculo por ID
                      </span>
                      <p className="text-2xl font-extrabold text-indigo-900 mt-1">
                        {report.vinculosPorIdDireto}
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
                        Foram cadastrados{' '}
                        <strong>{report.acessoriosCriados} novos acessórios</strong>, atualizados{' '}
                        <strong>{report.acessoriosAtualizados || 0} existentes</strong> e criados{' '}
                        <strong>{report.associacoesCriadas} novos vínculos</strong> (
                        {report.vinculosPorIdDireto} vinculados diretamente pelo ID Supabase e{' '}
                        {report.vinculosPorNomeFallback} por correspondência de nome).
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
                          <strong>{report.associacoesCriadas}</strong> vínculos foram criados com
                          sucesso ({report.vinculosPorIdDireto} por ID direto,{' '}
                          {report.vinculosPorNomeFallback} por nome),{' '}
                          <strong>{report.acessoriosCriados}</strong> novos acessórios cadastrados e{' '}
                          <strong>{report.acessoriosAtualizados || 0}</strong> acessórios
                          atualizados. No entanto,{' '}
                          <strong>{report.pendencias.length} versão(ões)</strong> não foram
                          localizadas no cadastro de máquinas.
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
                          Lista de Pendências — Versões não encontradas ({report.pendencias.length})
                        </h4>
                        <Badge variant="outline" className="text-xs border-rose-300 text-rose-800">
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
                                Versão / ID no Arquivo
                              </TableHead>
                              <TableHead className="text-xs font-bold text-rose-950">
                                Acessório Relacionado
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
                                  <div>{pend.versaoNome}</div>
                                  {pend.versaoId && (
                                    <span className="text-[10px] font-mono text-slate-500">
                                      ID: {pend.versaoId}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                                  {pend.acessoriosStr || '—'}
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

                  {/* Missing accessories pendencias if any */}
                  {report.pendenciasAcessorios && report.pendenciasAcessorios.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-slate-500" />
                          Acessórios não cadastrados ({report.pendenciasAcessorios.length})
                        </h4>
                      </div>

                      <div className="border rounded-lg overflow-x-auto max-h-56 overflow-y-auto bg-slate-50/50">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-100">
                              <TableHead className="text-xs font-bold w-16">Linha</TableHead>
                              <TableHead className="text-xs font-bold">Acessório</TableHead>
                              <TableHead className="text-xs font-bold">Versão Associada</TableHead>
                              <TableHead className="text-xs font-bold">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {report.pendenciasAcessorios.map((pAcc, pIdx) => (
                              <TableRow key={pIdx}>
                                <TableCell className="text-xs font-mono text-muted-foreground">
                                  #{pAcc.lineNumber}
                                </TableCell>
                                <TableCell className="text-xs font-semibold text-slate-800">
                                  {pAcc.acessorioNome}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {pAcc.versaoNome}
                                </TableCell>
                                <TableCell className="text-xs text-slate-600">
                                  {pAcc.motivo}
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
