import { useState, useRef, useMemo } from 'react'
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
  Database,
  ArrowRight,
  Info,
  Layers,
  ArrowRightLeft,
  FileText,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import {
  TARGET_COLUMNS,
  TargetClienteBaseAntiga,
  autoDetectColumnMapping,
  parseCSVFile,
  transformRowWithMapping,
} from '@/lib/csv-importer'
import { importarClientesAntigosBatch } from '@/services/clientes-antigos'

const BATCH_SIZE = 100

export default function ImportarBaseAntigaPage() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  // CSV parsed state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<keyof TargetClienteBaseAntiga, string>>(
    {
      nome: '',
      cnpj: '',
      email: '',
      telefone: '',
      contato: '',
      endereco: '',
      cidade: '',
      uf: '',
      cep: '',
    },
  )

  // Import execution state
  const [importing, setImporting] = useState(false)
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0)
  const [totalChunksCount, setTotalChunksCount] = useState(0)
  const [processedCount, setProcessedCount] = useState(0)
  const [progress, setProgress] = useState(0)

  // Results state
  const [result, setResult] = useState<{
    inseridos: number
    atualizados: number
    erros: number
    ignorados: number
    totalValidos: number
    errorMessages: string[]
  } | null>(null)

  // Transform rows based on current column mapping
  const transformedRows = useMemo(() => {
    if (rawRows.length === 0) return []
    return rawRows.map((r) => transformRowWithMapping(r, columnMapping))
  }, [rawRows, columnMapping])

  // Valid rows (must have CNPJ)
  const validRows = useMemo(() => {
    return transformedRows.filter((r) => !!r.cnpj)
  }, [transformedRows])

  const invalidCnpjCount = useMemo(() => {
    return Math.max(0, transformedRows.length - validRows.length)
  }, [transformedRows, validRows])

  const handleFileProcess = (selectedFile: File) => {
    if (
      !selectedFile.name.toLowerCase().endsWith('.csv') &&
      !selectedFile.name.toLowerCase().endsWith('.txt')
    ) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione um arquivo CSV (.csv).',
        variant: 'destructive',
      })
      return
    }

    setFile(selectedFile)
    setResult(null)
    setProgress(0)
    setProcessedCount(0)
    setCurrentChunkIndex(0)
    setTotalChunksCount(0)

    parseCSVFile(
      selectedFile,
      ({ headers, rawRows }) => {
        setCsvHeaders(headers)
        setRawRows(rawRows)

        const detected = autoDetectColumnMapping(headers)
        setColumnMapping(detected)

        toast({
          title: 'Arquivo CSV carregado!',
          description: `${rawRows.length} linhas lidas com sucesso. Verifique o mapeamento das colunas abaixo.`,
        })
      },
      (error) => {
        toast({
          title: 'Erro ao ler arquivo CSV',
          description: error.message,
          variant: 'destructive',
        })
      },
    )
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0])
    }
  }

  const handleMappingChange = (targetKey: keyof TargetClienteBaseAntiga, csvCol: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [targetKey]: csvCol === '__none__' ? '' : csvCol,
    }))
  }

  const handleStartImport = async () => {
    if (validRows.length === 0) {
      toast({
        title: 'Nenhum registro válido',
        description:
          'Verifique se a coluna CNPJ está mapeada corretamente e possui registros válidos.',
        variant: 'destructive',
      })
      return
    }

    setImporting(true)
    setProgress(0)
    setProcessedCount(0)
    setResult(null)

    let totalInseridos = 0
    let totalAtualizados = 0
    let totalErros = 0
    let totalIgnorados = invalidCnpjCount
    const errorMessages: string[] = []

    // Batching into chunks of 100
    const chunks: TargetClienteBaseAntiga[][] = []
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      chunks.push(validRows.slice(i, i + BATCH_SIZE))
    }

    setTotalChunksCount(chunks.length)

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      setCurrentChunkIndex(i + 1)

      try {
        const res = await importarClientesAntigosBatch(chunk)
        totalInseridos += res.inseridos
        totalAtualizados += res.atualizados
        if (res.ignorados) totalIgnorados += res.ignorados
      } catch (err) {
        totalErros += chunk.length
        const msg = err instanceof Error ? err.message : 'Erro desconhecido'
        errorMessages.push(`Lote ${i + 1} de ${chunks.length} (${chunk.length} registros): ${msg}`)
      }

      const processed = Math.min(validRows.length, (i + 1) * BATCH_SIZE)
      setProcessedCount(processed)
      setProgress(Math.round((processed / validRows.length) * 100))
    }

    const summary = {
      inseridos: totalInseridos,
      atualizados: totalAtualizados,
      erros: totalErros,
      ignorados: totalIgnorados,
      totalValidos: validRows.length,
      errorMessages,
    }

    setResult(summary)
    setImporting(false)

    // Save import audit in historico_importacoes
    try {
      await supabase.from('historico_importacoes').insert({
        tipo: 'Clientes Base Antiga (CSV)',
        arquivo: file?.name || 'base_clientes_antiga.csv',
        status:
          totalErros === 0
            ? 'Concluído'
            : totalInseridos + totalAtualizados > 0
              ? 'Parcial'
              : 'Falha',
        registros_importados: totalInseridos + totalAtualizados,
        registros_erro: totalErros,
        erros: errorMessages.length > 0 ? errorMessages : null,
        usuario: user?.email || 'Admin',
      })
    } catch (histErr) {
      console.warn('Erro ao salvar historico_importacoes:', histErr)
    }

    if (totalErros === 0) {
      toast({
        title: 'Importação concluída com sucesso!',
        description: `${totalInseridos} inseridos, ${totalAtualizados} atualizados.`,
      })
    } else {
      toast({
        title: 'Importação finalizada com alertas',
        description: `${totalInseridos + totalAtualizados} salvos, ${totalErros} erros registrados.`,
        variant: 'destructive',
      })
    }
  }

  const handleReset = () => {
    setFile(null)
    setCsvHeaders([])
    setRawRows([])
    setColumnMapping({
      nome: '',
      cnpj: '',
      email: '',
      telefone: '',
      contato: '',
      endereco: '',
      cidade: '',
      uf: '',
      cep: '',
    })
    setProgress(0)
    setProcessedCount(0)
    setCurrentChunkIndex(0)
    setTotalChunksCount(0)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header com identidade visual Bener */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#0b3c26]/10 text-[#0b3c26]">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0b3c26]">
                Importar Base Antiga de Clientes
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Upload de arquivo CSV com mapeamento inteligente de colunas e processamento em lotes
                para a tabela{' '}
                <code className="text-[#0b3c26] font-semibold">clientes_base_antiga</code>.
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

      {/* Info Banner */}
      <Alert className="bg-[#f0f7f3] border-[#0b3c26]/20 text-[#0b3c26]">
        <Info className="h-4 w-4 text-[#0b3c26]" />
        <AlertTitle className="font-semibold text-sm">
          Como funciona a importação e busca primária
        </AlertTitle>
        <AlertDescription className="text-xs text-[#0b3c26]/90 mt-1 leading-relaxed">
          Os registros são enviados em lotes de <strong>100 clientes</strong> para a Edge Function{' '}
          <code>importar-base-antiga</code>. A função realiza um <em>upsert</em> por CNPJ
          (desformatado), atualizando registros existentes ou inserindo novos. Os dados alimentam a
          busca primária instantânea no cadastro de clientes e propostas.
        </AlertDescription>
      </Alert>

      {/* Step 1: Dropzone de CSV */}
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
                accept=".csv, text/csv, text/plain"
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
                Arraste seu arquivo CSV da base antiga aqui
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 text-center max-w-lg leading-relaxed">
                ou clique para selecionar do computador. O arquivo será analisado no navegador via{' '}
                <strong>Papa Parse</strong> antes de iniciar o envio.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#0b3c26]" /> Aceita .csv
                </Badge>
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <Layers className="w-3.5 h-3.5 text-[#0b3c26]" /> Lotes automáticos de 100
                </Badge>
                <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3 bg-white">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-[#0b3c26]" /> Upsert por CNPJ
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 & 3: Mapeamento de Colunas, Prévia e Execução */}
      {file && (
        <div className="space-y-6">
          {/* File summary bar */}
          <Card className="shadow-sm border-[#0b3c26]/20 bg-gradient-to-r from-white via-white to-[#0b3c26]/5">
            <CardHeader className="py-4 px-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0b3c26] text-white flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                      {file.name}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Tamanho: {(file.size / 1024).toFixed(1)} KB &bull; Total no CSV:{' '}
                      <strong className="text-slate-800">{rawRows.length} linhas</strong> &bull;
                      Colunas detectadas:{' '}
                      <strong className="text-slate-800">{csvHeaders.length}</strong>
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-[#0b3c26]/30 text-[#0b3c26] bg-[#0b3c26]/5 text-xs font-semibold py-1 px-3"
                  >
                    {validRows.length} registros prontos com CNPJ
                  </Badge>
                  {invalidCnpjCount > 0 && (
                    <Badge variant="secondary" className="text-xs py-1 px-2.5">
                      {invalidCnpjCount} sem CNPJ
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Column Mapping Section */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#0b3c26] flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4" /> Mapeamento de Colunas (CSV → Banco de
                    Dados)
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Confirme ou altere a correspondência entre os cabeçalhos do arquivo CSV e os
                    campos da tabela <code>clientes_base_antiga</code>.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-normal">
                  {TARGET_COLUMNS.filter((c) => !!columnMapping[c.key]).length} de{' '}
                  {TARGET_COLUMNS.length} mapeadas
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {TARGET_COLUMNS.map((col) => {
                  const currentSelected = columnMapping[col.key] || '__none__'
                  const isMapped = !!columnMapping[col.key]

                  return (
                    <div
                      key={col.key}
                      className={`p-3 rounded-lg border transition-all ${
                        col.required && !isMapped
                          ? 'border-amber-400 bg-amber-50/50'
                          : isMapped
                            ? 'border-[#0b3c26]/30 bg-[#f0f7f3]/50'
                            : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          {col.label}
                          {col.required && (
                            <span className="text-[10px] text-red-500 font-normal">
                              *obrigatório
                            </span>
                          )}
                        </span>
                        <code className="text-[10px] bg-white px-1.5 py-0.5 rounded border text-muted-foreground font-mono">
                          {col.key}
                        </code>
                      </div>
                      <Select
                        value={currentSelected}
                        onValueChange={(val) => handleMappingChange(col.key, val)}
                        disabled={importing}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue placeholder="Selecione a coluna CSV" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value="__none__"
                            className="text-xs text-muted-foreground italic"
                          >
                            (Não mapear / Em branco)
                          </SelectItem>
                          {csvHeaders.map((header) => (
                            <SelectItem key={header} value={header} className="text-xs font-mono">
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                        {col.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Preview Table of First 5 rows */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-[#0b3c26]" />
                    Prévia dos Primeiros 5 Registros Mapeados
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Exibição em tempo real com as regras de limpeza (CNPJ e CEP sem formatação).
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  Mostrando {Math.min(5, validRows.length)} de {validRows.length} registros válidos
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="border rounded-lg overflow-x-auto bg-slate-50/50">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="text-xs font-bold w-10">#</TableHead>
                      <TableHead className="text-xs font-bold">Nome / Razão</TableHead>
                      <TableHead className="text-xs font-bold">CNPJ (Limpo)</TableHead>
                      <TableHead className="text-xs font-bold">E-mail</TableHead>
                      <TableHead className="text-xs font-bold">Telefone</TableHead>
                      <TableHead className="text-xs font-bold">Contato</TableHead>
                      <TableHead className="text-xs font-bold">Endereço</TableHead>
                      <TableHead className="text-xs font-bold">Cidade / UF</TableHead>
                      <TableHead className="text-xs font-bold">CEP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-center py-6 text-xs text-muted-foreground"
                        >
                          Nenhum registro com CNPJ válido encontrado com o mapeamento atual.
                        </TableCell>
                      </TableRow>
                    ) : (
                      validRows.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx} className="hover:bg-white/80 transition-colors">
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="text-xs font-medium max-w-[180px] truncate">
                            {row.nome || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-xs font-mono font-semibold text-[#0b3c26]">
                            {row.cnpj || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate text-muted-foreground">
                            {row.email || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.telefone || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.contato || '—'}
                          </TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate text-muted-foreground">
                            {row.endereco || '—'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.cidade || '—'} {row.uf ? `(${row.uf})` : ''}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {row.cep || '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Action & Progress Card */}
          <Card className="shadow-sm border-[#0b3c26]/30">
            <CardContent className="p-6">
              {/* Active Progress Bar */}
              {importing && (
                <div className="space-y-3 mb-6 bg-[#f0f7f3] p-5 rounded-xl border border-[#0b3c26]/20">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center text-xs text-[#0b3c26] font-semibold gap-1">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#0b3c26]" />
                      Importando lote {currentChunkIndex} de {totalChunksCount}...
                    </span>
                    <span className="font-mono">
                      {processedCount} de {validRows.length} registros ({progress}%)
                    </span>
                  </div>
                  <Progress value={progress} className="h-3 bg-[#0b3c26]/10" />
                  <p className="text-[11px] text-[#0b3c26]/80 italic">
                    Processando em lotes de {BATCH_SIZE} registros via Edge Function com upsert no
                    banco de dados...
                  </p>
                </div>
              )}

              {/* Final Results Summary */}
              {result && (
                <div className="mb-6 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                      <span className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">
                        Inseridos
                      </span>
                      <p className="text-3xl font-extrabold text-emerald-800 mt-1">
                        {result.inseridos}
                      </p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                      <span className="text-xs text-blue-700 font-semibold uppercase tracking-wider">
                        Atualizados
                      </span>
                      <p className="text-3xl font-extrabold text-blue-800 mt-1">
                        {result.atualizados}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                      <span className="text-xs text-slate-700 font-semibold uppercase tracking-wider">
                        Processados
                      </span>
                      <p className="text-3xl font-extrabold text-slate-800 mt-1">
                        {result.inseridos + result.atualizados}
                      </p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                      <span className="text-xs text-amber-700 font-semibold uppercase tracking-wider">
                        Ignorados / Erros
                      </span>
                      <p className="text-3xl font-extrabold text-amber-800 mt-1">
                        {result.erros + result.ignorados}
                      </p>
                    </div>
                  </div>

                  {result.erros === 0 ? (
                    <Alert className="bg-emerald-50 border-emerald-300 text-emerald-900">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <AlertTitle className="font-bold text-sm">
                        Importação concluída com sucesso!
                      </AlertTitle>
                      <AlertDescription className="text-xs mt-1 text-emerald-800 leading-relaxed">
                        Foram inseridos <strong>{result.inseridos}</strong> novos registros e{' '}
                        <strong>{result.atualizados}</strong> atualizados na tabela{' '}
                        <code>clientes_base_antiga</code>. A busca primária já está ativa com os
                        novos dados.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-5 w-5" />
                      <AlertTitle className="font-bold text-sm">
                        Importação concluída com avisos
                      </AlertTitle>
                      <AlertDescription className="text-xs mt-1 leading-relaxed space-y-1">
                        <p>
                          {result.inseridos + result.atualizados} salvos com sucesso, mas{' '}
                          {result.erros} registros apresentaram erro:
                        </p>
                        <div className="font-mono text-[11px] bg-red-100/60 p-2 rounded max-h-32 overflow-y-auto">
                          {result.errorMessages.map((msg, idx) => (
                            <div key={idx}>{msg}</div>
                          ))}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {validRows.length > 0 ? (
                    <span>
                      Pronto para importar <strong>{validRows.length} registros</strong> em{' '}
                      <strong>{Math.ceil(validRows.length / BATCH_SIZE)} lotes</strong>.
                    </span>
                  ) : (
                    <span className="text-amber-600 font-medium">
                      Mapeie a coluna CNPJ para habilitar a importação.
                    </span>
                  )}
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
                    disabled={importing || validRows.length === 0 || !!result}
                    className="flex-1 sm:flex-initial bg-[#0b3c26] hover:bg-[#082e1d] text-white gap-2 font-semibold px-6 shadow-sm"
                  >
                    {importing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Importando...
                      </>
                    ) : result ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Importação Finalizada
                      </>
                    ) : (
                      <>
                        Importar {validRows.length} registros <ArrowRight className="w-4 h-4" />
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
