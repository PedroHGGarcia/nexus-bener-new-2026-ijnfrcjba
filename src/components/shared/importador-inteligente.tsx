import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  tableName: string
  columns: string[]
  onImport: (rows: Record<string, unknown>[]) => Promise<void>
}
type Step = 'upload' | 'mapping' | 'validating' | 'results'

export function ImportadorInteligente({ open, onOpenChange, tableName, columns, onImport }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [imported, setImported] = useState(0)

  const reset = () => {
    setStep('upload')
    setFile(null)
    setHeaders([])
    setMapping({})
    setRows([])
    setErrors([])
    setImported(0)
  }

  const parseCsv = (text: string) => {
    const lines = text.split('\n').filter((l) => l.trim())
    const parsedHeaders = (lines[0] || '').split(',').map((h) => h.trim().replace(/"/g, ''))
    const parsedRows = lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.trim().replace(/"/g, ''))
      const obj: Record<string, unknown> = {}
      parsedHeaders.forEach((h, i) => {
        obj[h] = vals[i] ?? ''
      })
      return obj
    })
    return { headers: parsedHeaders, rows: parsedRows }
  }

  const handleFile = async (f: File) => {
    setFile(f)
    setStep('validating')
    try {
      const text = await f.text()
      const { headers: hs, rows: rs } = parseCsv(text)
      setHeaders(hs)
      setRows(rs)
      const initMap: Record<string, string> = {}
      hs.forEach((h) => {
        const match = columns.find((c) => c.toLowerCase() === h.toLowerCase())
        initMap[h] = match ?? ''
      })
      setMapping(initMap)
      setStep('mapping')
    } catch {
      toast({ title: 'Erro ao processar arquivo', variant: 'destructive' })
      setStep('upload')
    }
  }

  const doImport = useCallback(async () => {
    setStep('validating')
    const mapped = rows.map((row) => {
      const obj: Record<string, unknown> = {}
      Object.entries(mapping).forEach(([src, dest]) => {
        if (dest) obj[dest] = row[src]
      })
      return obj
    })
    try {
      await onImport(mapped)
      setImported(mapped.length)
      setStep('results')
      toast({ title: `${mapped.length} registro(s) importado(s)!` })
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Erro na importação'])
      setStep('results')
    }
  }, [rows, mapping, onImport])

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reset()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importação Inteligente — {tableName}</DialogTitle>
        </DialogHeader>
        {step === 'upload' && (
          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              id="import-file"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <label htmlFor="import-file" className="cursor-pointer">
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Selecione um arquivo CSV ou Excel</p>
              <p className="text-xs text-muted-foreground mt-1">Arraste ou clique para escolher</p>
            </label>
          </div>
        )}
        {step === 'mapping' && (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Mapeie as colunas do arquivo para os campos do sistema:
            </p>
            {headers.map((h) => (
              <div key={h} className="flex items-center gap-2">
                <span className="text-xs font-medium flex-1 truncate">{h}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <Select
                  value={mapping[h] || '_none'}
                  onValueChange={(v) => setMapping({ ...mapping, [h]: v === '_none' ? '' : v })}
                >
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Ignorar —</SelectItem>
                    {columns.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
        {step === 'validating' && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        {step === 'results' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">
                {imported} registro(s) importado(s) com sucesso!
              </span>
            </div>
            {errors.length > 0 && (
              <div className="space-y-1">
                {errors.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-destructive">
                    <XCircle className="w-3.5 h-3.5" /> {e}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          {step === 'mapping' && (
            <Button className="bg-primary" onClick={doImport}>
              Importar {rows.length} registro(s)
            </Button>
          )}
          {step === 'results' && (
            <Button
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
            >
              Fechar
            </Button>
          )}
          {step === 'upload' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
