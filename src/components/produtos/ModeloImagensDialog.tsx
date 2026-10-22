import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Upload,
  Trash2,
  Image as ImageIcon,
  Loader2,
  ExternalLink,
  FileText,
  AlertCircle,
  Eye,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { ModeloImagem } from '@/types/modelo'
import {
  fetchModeloImagens,
  uploadModeloImagem,
  deleteModeloImagem,
} from '@/services/modelo-imagens'

interface ModeloImagensDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  modeloId: string
  modeloNome: string
  canEdit?: boolean
}

const TIPOS_DOCUMENTO = [
  { value: 'plaqueta', label: 'Plaqueta de Identificação' },
  { value: 'tabela_injecao', label: 'Tabela de Injeção' },
  { value: 'diagrama_hidraulico', label: 'Diagrama Hidráulico' },
  { value: 'diagrama_eletrico', label: 'Diagrama Elétrico' },
  { value: 'especificacao', label: 'Especificação Técnica' },
  { value: 'manual', label: 'Página de Manual' },
  { value: 'outro', label: 'Outro' },
]

export function ModeloImagensDialog({
  open,
  onOpenChange,
  modeloId,
  modeloNome,
  canEdit = true,
}: ModeloImagensDialogProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [imagens, setImagens] = useState<ModeloImagem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewItem, setPreviewItem] = useState<ModeloImagem | null>(null)

  // Form states for new upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [descricao, setDescricao] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState('plaqueta')

  useEffect(() => {
    if (open && modeloId) {
      loadImagens()
      resetForm()
    }
  }, [open, modeloId])

  function resetForm() {
    setSelectedFile(null)
    setDescricao('')
    setTipoDocumento('plaqueta')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function loadImagens() {
    try {
      setLoading(true)
      const data = await fetchModeloImagens(modeloId)
      setImagens(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar imagens'
      toast({
        title: 'Erro',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Selecione uma imagem (PNG, JPG, JPEG, WEBP).',
        variant: 'destructive',
      })
      return
    }

    // Sugere descrição inicial com base no nome do arquivo se estiver vazio
    if (!descricao) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      setDescricao(nameWithoutExt)
    }

    setSelectedFile(file)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile || !modeloId) return

    try {
      setUploading(true)
      await uploadModeloImagem({
        file: selectedFile,
        modeloId,
        descricao: descricao.trim() || undefined,
        tipoDocumento,
      })

      toast({
        title: 'Sucesso',
        description: 'Imagem técnica adicionada à biblioteca do modelo.',
      })

      resetForm()
      await loadImagens()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao enviar imagem'
      toast({
        title: 'Erro no envio',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(item: ModeloImagem) {
    const conf = window.confirm(
      `Deseja realmente excluir a imagem "${item.descricao || item.nome_arquivo || 'técnica'}" da biblioteca?`,
    )
    if (!conf) return

    try {
      setDeletingId(item.id)
      await deleteModeloImagem(item)
      toast({
        title: 'Excluída',
        description: 'Imagem removida da biblioteca.',
      })
      setImagens((prev) => prev.filter((i) => i.id !== item.id))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir'
      toast({
        title: 'Erro',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setDeletingId(null)
    }
  }

  function getTipoLabel(tipo?: string | null) {
    const found = TIPOS_DOCUMENTO.find((t) => t.value === tipo)
    return found ? found.label : tipo || 'Documento técnico'
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  Biblioteca Técnica — {modeloNome}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                  Imagens técnicas de plaqueta, tabelas de injeção e diagramas vinculados a este
                  modelo. A assistente Bener Tech I.A usará essas imagens para responder dúvidas com
                  precisão.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Upload Area (only if authorized) */}
            {canEdit && (
              <form
                onSubmit={handleUpload}
                className="border-2 border-dashed rounded-xl p-4 sm:p-5 bg-card/60 hover:bg-muted/30 transition-colors space-y-4"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-primary" />
                      Adicionar Nova Imagem Técnica
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Suba fotos legíveis de plaquetas, diagramas ou folhas de dados (PNG, JPG,
                      WEBP).
                    </p>
                  </div>
                  {selectedFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetForm}
                      disabled={uploading}
                      className="text-xs text-muted-foreground"
                    >
                      Trocar arquivo
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5 space-y-1.5">
                    <Label className="text-xs">Tipo de Documento</Label>
                    <Select
                      value={tipoDocumento}
                      onValueChange={setTipoDocumento}
                      disabled={uploading}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_DOCUMENTO.map((t) => (
                          <SelectItem key={t.value} value={t.value} className="text-xs">
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-7 space-y-1.5">
                    <Label className="text-xs">
                      Descrição / Rótulo <span className="text-muted-foreground">(opcional)</span>
                    </Label>
                    <Input
                      placeholder="Ex.: Plaqueta principal nº de série 2024"
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      disabled={uploading}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto text-xs h-9"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                    {selectedFile ? selectedFile.name : 'Selecionar arquivo do computador'}
                  </Button>

                  {selectedFile && (
                    <span className="text-xs text-muted-foreground truncate max-w-xs">
                      {(selectedFile.size / 1024).toFixed(0)} KB
                    </span>
                  )}

                  <div className="sm:ml-auto w-full sm:w-auto">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!selectedFile || uploading}
                      className="w-full sm:w-auto text-xs h-9 bg-primary"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          Salvar na Biblioteca
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* Imagens List / Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">
                  Imagens cadastradas ({imagens.length})
                </h4>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs">Carregando imagens...</p>
                </div>
              ) : imagens.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center bg-muted/10 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                    <FileText className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Nenhuma imagem cadastrada para este modelo
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Envie plaquetas ou tabelas acima para que a Bener Tech I.A possa consultar as
                    fotos automaticamente quando um representante perguntar sobre este modelo.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {imagens.map((item) => (
                    <div
                      key={item.id}
                      className="group relative rounded-xl border bg-card overflow-hidden hover:shadow-md transition-all flex flex-col"
                    >
                      {/* Thumbnail container */}
                      <div
                        className="relative aspect-[4/3] bg-muted/40 overflow-hidden cursor-pointer"
                        onClick={() => setPreviewItem(item)}
                      >
                        <img
                          src={item.url}
                          alt={item.descricao || item.nome_arquivo || 'Imagem técnica'}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPreviewItem(item)
                            }}
                            title="Visualizar em tamanho grande"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
                            title="Abrir imagem original"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        <Badge
                          variant="secondary"
                          className="absolute top-2 left-2 text-[10px] bg-background/90 backdrop-blur-sm"
                        >
                          {getTipoLabel(item.tipo_documento)}
                        </Badge>
                      </div>

                      {/* Details & Actions */}
                      <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                        <div>
                          <p
                            className="text-xs font-semibold text-foreground line-clamp-1"
                            title={item.descricao || item.nome_arquivo || 'Sem descrição'}
                          >
                            {item.descricao || item.nome_arquivo || 'Imagem técnica'}
                          </p>
                          {item.nome_arquivo && item.descricao && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {item.nome_arquivo}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(item.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                            {item.tamanho_bytes
                              ? ` • ${(item.tamanho_bytes / 1024).toFixed(0)} KB`
                              : ''}
                          </p>
                        </div>

                        {canEdit && (
                          <div className="flex items-center justify-end pt-1 border-t">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                              onClick={() => handleDelete(item)}
                              disabled={deletingId === item.id}
                            >
                              {deletingId === item.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                              )}
                              Excluir
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Large Image Preview Modal */}
      {previewItem && (
        <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-neutral-800 text-white">
            <div className="p-4 flex items-center justify-between border-b border-neutral-800">
              <div>
                <h3 className="font-semibold text-sm">
                  {previewItem.descricao || previewItem.nome_arquivo || 'Imagem técnica'}
                </h3>
                <p className="text-xs text-neutral-400">
                  {getTipoLabel(previewItem.tipo_documento)} • {modeloNome}
                </p>
              </div>
              <a
                href={previewItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs flex items-center gap-1 text-primary-foreground hover:underline mr-8"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir original
              </a>
            </div>
            <div className="max-h-[75vh] flex items-center justify-center p-4 overflow-auto">
              <img
                src={previewItem.url}
                alt={previewItem.descricao || 'Preview'}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
