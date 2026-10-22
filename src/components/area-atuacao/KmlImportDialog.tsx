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
import { Loader2, Upload, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { parseKml, validateGeometry, toGeoJson, getDefaultColor } from '@/lib/kml-parser'
import { insertTerritorio } from '@/services/area-atuacao'
import { Representante } from '@/types/representante'
import { KmlImportResult } from '@/types/area-atuacao'

interface KmlImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  representantes: Representante[]
  onImported: () => void
}

export function KmlImportDialog({
  open,
  onOpenChange,
  representantes,
  onImported,
}: KmlImportDialogProps) {
  const [files, setFiles] = useState<File[]>([])
  const [selectedRep, setSelectedRep] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<KmlImportResult[]>([])
  const [done, setDone] = useState(false)

  const reset = () => {
    setFiles([])
    setSelectedRep('')
    setResults([])
    setDone(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    setFiles(selected)
    setResults([])
    setDone(false)
  }

  const handleImport = useCallback(async () => {
    if (files.length === 0) {
      toast({ title: 'Selecione ao menos um arquivo KML', variant: 'destructive' })
      return
    }

    setImporting(true)
    setResults([])
    const importResults: KmlImportResult[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const text = await file.text()
        const geometries = parseKml(text)

        let successCount = 0
        for (const geom of geometries) {
          if (!validateGeometry(geom)) {
            throw new Error(`Geometria inválida ou vazia em ${file.name}`)
          }
          const geoJson = toGeoJson(geom)
          await insertTerritorio({
            representante: selectedRep || null,
            geometria: geoJson,
            cor: getDefaultColor(i),
          })
          successCount++
        }

        importResults.push({
          fileName: file.name,
          success: true,
        })
      } catch (err) {
        importResults.push({
          fileName: file.name,
          success: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        })
      }
    }

    setResults(importResults)
    setDone(true)
    setImporting(false)

    const successCount = importResults.filter((r) => r.success).length
    if (successCount > 0) {
      toast({
        title: 'Importação concluída',
        description: `${successCount} de ${importResults.length} arquivo(s) importado(s) com sucesso.`,
      })
      onImported()
    } else {
      toast({
        title: 'Falha na importação',
        description: 'Nenhum arquivo pôde ser importado.',
        variant: 'destructive',
      })
    }
  }, [files, selectedRep, onImported])

  const successCount = results.filter((r) => r.success).length
  const failCount = results.filter((r) => !r.success).length

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
          <DialogTitle>Importar Territórios (KML)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Representante (opcional)</Label>
            <Select value={selectedRep} onValueChange={setSelectedRep}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um representante" />
              </SelectTrigger>
              <SelectContent>
                {representantes.map((rep) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {rep.fantasia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              O representante será atribuído a todos os territórios importados.
            </p>
          </div>

          <div>
            <Label className="mb-1.5 block">Arquivos KML</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept=".kml"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="kml-upload"
              />
              <label htmlFor="kml-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  Clique para selecionar arquivos KML
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Você pode selecionar múltiplos arquivos
                </p>
              </label>
            </div>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {f.name}
                    <span className="ml-auto">({(f.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {done && (
            <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertCircle className="w-4 h-4 text-primary" />
                Resumo da Importação
              </div>
              <div className="flex gap-4 text-xs">
                <span className="text-muted-foreground">
                  Total: <strong className="text-foreground">{results.length}</strong>
                </span>
                <span className="text-green-600">
                  Sucesso: <strong>{successCount}</strong>
                </span>
                <span className="text-destructive">
                  Falhas: <strong>{failCount}</strong>
                </span>
              </div>
              {results.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs py-1 border-t border-border/50"
                >
                  {r.success ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-medium">{r.fileName}</span>
                    {r.error && <p className="text-destructive mt-0.5">{r.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              reset()
            }}
          >
            Fechar
          </Button>
          <Button
            className="bg-primary"
            disabled={importing || files.length === 0}
            onClick={handleImport}
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-1" />
                Importar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
