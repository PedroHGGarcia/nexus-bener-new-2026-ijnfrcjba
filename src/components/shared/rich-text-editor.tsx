import { useRef, useEffect, useState } from 'react'
import { escapeHtml, sanitizeHtml } from '@/lib/escape-html'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  Eraser,
  Palette,
  Image as ImageIcon,
  Code2,
  List,
  ListOrdered,
  Link2,
  Table as TableIcon,
  Undo,
  Redo,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { uploadVersaoImage } from '@/services/versoes'
import { toast } from '@/hooks/use-toast'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  /**
   * Optional custom upload handler; defaults to uploadVersaoImage (bucket versao-images).
   */
  onImageUpload?: (file: File) => Promise<string | null>
}

const PRESET_COLORS = [
  { name: 'Padrão (Escuro)', value: '#0f172a' },
  { name: 'Verde Bener', value: '#0b3c26' },
  { name: 'Verde Esmeralda', value: '#059669' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Vermelho', value: '#dc2626' },
  { name: 'Laranja', value: '#ea580c' },
  { name: 'Cinza Escuro', value: '#475569' },
  { name: 'Cinza Médio', value: '#64748b' },
]

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escreva aqui as informações técnicas...',
  className,
  minHeight = 'min-h-[220px]',
  onImageUpload,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const savedSelectionRef = useRef<Range | null>(null)

  const [isSourceView, setIsSourceView] = useState(false)
  const [sourceCode, setSourceCode] = useState(value || '')
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState('#0b3c26')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Table Dialog State
  const [tableDialogOpen, setTableDialogOpen] = useState(false)
  const [columnCount, setColumnCount] = useState<number>(3)
  const [columnHeaders, setColumnHeaders] = useState<string[]>([
    'Item / Componente',
    'Descrição / Especificação',
    'Observação',
  ])
  const [rowCount, setRowCount] = useState<number>(2)

  // Keep internal state in sync with external value
  useEffect(() => {
    if (editorRef.current && !isSourceView) {
      if (editorRef.current.innerHTML !== (value || '')) {
        editorRef.current.innerHTML = sanitizeHtml(value || '')
      }
    }
    setSourceCode(value || '')
  }, [value, isSourceView])

  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange()
    }
  }

  const restoreSelection = () => {
    const range = savedSelectionRef.current
    if (range) {
      const sel = window.getSelection()
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }

  const exec = (cmd: string, val?: string) => {
    if (isSourceView) return
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand(cmd, false, val)
    if (editorRef.current) {
      const html = editorRef.current.innerHTML
      onChange(html)
      setSourceCode(html)
    }
  }

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML
      onChange(html)
      setSourceCode(html)
    }
  }

  // Clear formatting
  const handleClearFormatting = () => {
    if (isSourceView) return
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand('removeFormat', false, undefined)
    document.execCommand('unlink', false, undefined)
    if (editorRef.current) {
      const html = editorRef.current.innerHTML
      onChange(html)
      setSourceCode(html)
    }
  }

  // Text Color
  const handleApplyColor = (color: string) => {
    setSelectedColor(color)
    setColorPickerOpen(false)
    exec('foreColor', color)
  }

  // Link
  const handleLink = () => {
    if (isSourceView) return
    const url = window.prompt('Insira a URL do link:')
    if (url) {
      exec('createLink', url)
    }
  }

  // Image Upload
  const handleImageButtonClick = () => {
    if (isSourceView) return
    saveSelection()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingImage(true)
    try {
      const uploader = onImageUpload || uploadVersaoImage
      const url = await uploader(file)
      if (!url) {
        throw new Error('Não foi possível obter o endereço da imagem enviada.')
      }

      editorRef.current?.focus()
      restoreSelection()

      // Insere imagem formatada com suporte a redimensionamento e alinhamento
      const imgHtml = `
        <figure style="display:inline-block;margin:8px 0;max-width:100%;">
          <img
            src="${url}"
            alt="${file.name.replace(/\.[^/.]+$/, '')}"
            style="max-width:100%;max-height:360px;object-fit:contain;border-radius:4px;border:1px solid #cbd5e1;display:block;"
          />
        </figure>
      `
      document.execCommand('insertHTML', false, imgHtml)

      if (editorRef.current) {
        const html = editorRef.current.innerHTML
        onChange(html)
        setSourceCode(html)
      }

      toast({
        title: 'Imagem inserida',
        description: 'A foto foi anexada ao campo técnico com sucesso.',
      })
    } catch (err) {
      toast({
        title: 'Erro no envio da foto',
        description: err instanceof Error ? err.message : 'Falha ao fazer upload da imagem',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingImage(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Open dialog to configure table insertion
  const handleOpenTableDialog = () => {
    if (isSourceView) return
    saveSelection()
    // Inicializa valores padrão
    setColumnCount(3)
    setColumnHeaders(['Item / Componente', 'Descrição / Especificação', 'Observação'])
    setRowCount(2)
    setTableDialogOpen(true)
  }

  const handleColumnCountChange = (count: number) => {
    const clamped = Math.max(1, Math.min(10, count || 1))
    setColumnCount(clamped)
    setColumnHeaders((prev) => {
      const next = [...prev]
      if (clamped > next.length) {
        for (let i = next.length; i < clamped; i++) {
          if (i === 0) next.push('Item / Componente')
          else if (i === 1) next.push('Descrição / Especificação')
          else if (i === 2) next.push('Observação')
          else next.push(`Coluna ${i + 1}`)
        }
      } else if (clamped < next.length) {
        return next.slice(0, clamped)
      }
      return next
    })
  }

  const handleHeaderNameChange = (index: number, value: string) => {
    setColumnHeaders((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  // Insert Configurable Spec Table
  const handleConfirmInsertTable = () => {
    const cols = Math.max(1, Math.min(10, columnCount || 1))
    const rows = Math.max(1, Math.min(20, rowCount || 1))

    // Sanitiza e gera cabeçalhos escapados
    const thsHtml = Array.from({ length: cols })
      .map((_, i) => {
        const raw = columnHeaders[i]?.trim()
        const label =
          raw ||
          (i === 0 ? 'Item' : i === 1 ? 'Descrição' : i === 2 ? 'Observação' : `Coluna ${i + 1}`)
        return `<th style="border:1px solid #cbd5e1;padding:6px 8px;font-size:11px;font-weight:700;text-align:left;">${escapeHtml(label)}</th>`
      })
      .join('')

    // Gera linhas do corpo (tbody)
    const rowsHtml = Array.from({ length: rows })
      .map((_, rIdx) => {
        const tdsHtml = Array.from({ length: cols })
          .map((_, cIdx) => {
            const defaultVal = cIdx === 0 ? String(rIdx + 1) : '&nbsp;'
            return `<td style="border:1px solid #cbd5e1;padding:5px 8px;font-size:11px;">${defaultVal}</td>`
          })
          .join('')
        return `<tr>${tdsHtml}</tr>`
      })
      .join('')

    const tableHtml = `
      <table class="spec-table" style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;margin:8px 0;">
        <thead>
          <tr style="background:#f1f5f9;color:#334155;">
            ${thsHtml}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <p><br /></p>
    `

    setTableDialogOpen(false)
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand('insertHTML', false, tableHtml)

    if (editorRef.current) {
      const html = editorRef.current.innerHTML
      onChange(html)
      setSourceCode(html)
    }

    toast({
      title: 'Tabela inserida',
      description: `Tabela com ${cols} coluna(s) adicionada às especificações.`,
    })
  }

  // Toggle Source Code View
  const handleToggleSourceView = () => {
    if (isSourceView) {
      // Exiting source view: update visual editor
      const clean = sanitizeHtml(sourceCode)
      onChange(clean)
      if (editorRef.current) {
        editorRef.current.innerHTML = clean
      }
      setIsSourceView(false)
    } else {
      // Entering source view: sync source text
      if (editorRef.current) {
        setSourceCode(editorRef.current.innerHTML)
      }
      setIsSourceView(true)
    }
  }

  const handleSourceCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSourceCode(e.target.value)
    onChange(e.target.value)
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-slate-300 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col transition-all',
        isFullscreen && 'fixed inset-4 z-50 shadow-2xl border-2 border-[#0b3c26]',
        className,
      )}
    >
      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Word-like Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50/90 p-1.5 dark:border-slate-800 dark:bg-slate-800/80">
        {/* Formatting group: Bold, Italic, Underline, Strikethrough */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-700 hover:text-[#0b3c26] hover:bg-slate-200/70"
          onClick={() => exec('bold')}
          title="Negrito (Ctrl+B)"
          disabled={isSourceView}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-700 hover:text-[#0b3c26] hover:bg-slate-200/70"
          onClick={() => exec('italic')}
          title="Itálico (Ctrl+I)"
          disabled={isSourceView}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-700 hover:text-[#0b3c26] hover:bg-slate-200/70"
          onClick={() => exec('underline')}
          title="Sublinhado (Ctrl+U)"
          disabled={isSourceView}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-700 hover:text-[#0b3c26] hover:bg-slate-200/70"
          onClick={() => exec('strikeThrough')}
          title="Tachado"
          disabled={isSourceView}
        >
          <StrikethroughIcon className="h-4 w-4" />
        </Button>

        {/* Clear formatting (eraser) */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-700 hover:text-red-600 hover:bg-slate-200/70"
          onClick={handleClearFormatting}
          title="Limpar formatação"
          disabled={isSourceView}
        >
          <Eraser className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-0.5 bg-slate-300 dark:bg-slate-700" />

        {/* Text color picker */}
        <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 relative text-slate-700 hover:text-[#0b3c26] hover:bg-slate-200/70"
              title="Cor do texto"
              disabled={isSourceView}
              onClick={saveSelection}
            >
              <Palette className="h-4 w-4" />
              <span
                className="absolute bottom-1 left-2 right-2 h-0.5 rounded-full"
                style={{ backgroundColor: selectedColor }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2.5 bg-white border border-slate-200 shadow-md">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide block">
                Cor do texto
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => handleApplyColor(c.value)}
                    title={c.name}
                    className="h-6 w-full rounded border border-slate-200 transition-transform hover:scale-110 flex items-center justify-center"
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
              <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1.5">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => handleApplyColor(e.target.value)}
                  className="h-6 w-8 cursor-pointer border rounded p-0 bg-transparent"
                  title="Cor personalizada"
                />
                <span className="text-[11px] text-slate-600">Personalizado</span>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6 mx-0.5 bg-slate-300 dark:bg-slate-700" />

        {/* Lists */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-700 hover:text-[#0b3c26] hover:bg-slate-200/70"
          onClick={() => exec('insertUnorderedList')}
          title="Lista com marcadores"
          disabled={isSourceView}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-700 hover:text-[#0b3c26] hover:bg-slate-200/70"
          onClick={() => exec('insertOrderedList')}
          title="Lista numerada"
          disabled={isSourceView}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        {/* Link */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-700 hover:text-[#0b3c26] hover:bg-slate-200/70"
          onClick={handleLink}
          title="Inserir link"
          disabled={isSourceView}
        >
          <Link2 className="h-4 w-4" />
        </Button>

        {/* Table insert helper */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs gap-1 font-medium text-slate-700 hover:text-[#0b3c26] hover:bg-slate-200/70"
          onClick={handleOpenTableDialog}
          title="Inserir tabela de especificações configurável"
          disabled={isSourceView}
        >
          <TableIcon className="h-4 w-4 text-[#0b3c26]" />
          <span className="hidden sm:inline">Tabela</span>
        </Button>

        {/* Image upload button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs gap-1 font-medium text-slate-700 hover:text-[#0b3c26] hover:bg-slate-200/70"
          onClick={handleImageButtonClick}
          title="Inserir imagem do seu dispositivo"
          disabled={isSourceView || isUploadingImage}
        >
          {isUploadingImage ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#0b3c26]" />
          ) : (
            <ImageIcon className="h-4 w-4 text-[#0b3c26]" />
          )}
          <span className="hidden sm:inline">Imagem</span>
        </Button>

        <Separator orientation="vertical" className="h-6 mx-0.5 bg-slate-300 dark:bg-slate-700" />

        {/* Undo / Redo */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-700 hover:text-[#0b3c26] hover:bg-slate-200/70"
          onClick={() => exec('undo')}
          title="Desfazer (Ctrl+Z)"
          disabled={isSourceView}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-700 hover:text-[#0b3c26] hover:bg-slate-200/70"
          onClick={() => exec('redo')}
          title="Refazer (Ctrl+Y)"
          disabled={isSourceView}
        >
          <Redo className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        {/* Source view toggle button (</>) */}
        <Button
          type="button"
          variant={isSourceView ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            'h-8 px-2 text-xs gap-1 font-mono',
            isSourceView
              ? 'bg-[#0b3c26] text-white hover:bg-[#0b3c26]/90'
              : 'text-slate-700 hover:text-[#0b3c26] hover:bg-slate-200/70',
          )}
          onClick={handleToggleSourceView}
          title={isSourceView ? 'Voltar para modo visual' : 'Ver código HTML (código-fonte)'}
        >
          <Code2 className="h-3.5 w-3.5" />
          <span>{isSourceView ? 'Visual' : '</>'}</span>
        </Button>

        {/* Fullscreen toggle */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-700 hover:text-[#0b3c26] hover:bg-slate-200/70"
          onClick={() => setIsFullscreen((prev) => !prev)}
          title={isFullscreen ? 'Restaurar tamanho' : 'Expandir editor'}
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Table Configuration Dialog */}
      <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <TableIcon className="w-4 h-4 text-[#0b3c26]" />
              Inserir Tabela de Especificações
            </DialogTitle>
            <DialogDescription className="text-xs">
              Escolha a quantidade de colunas e personalize os cabeçalhos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="col-count" className="text-xs font-semibold">
                  Nº de Colunas (1 a 10)
                </Label>
                <Input
                  id="col-count"
                  type="number"
                  min={1}
                  max={10}
                  value={columnCount}
                  onChange={(e) => handleColumnCountChange(parseInt(e.target.value, 10))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="row-count" className="text-xs font-semibold">
                  Linhas Iniciais (1 a 20)
                </Label>
                <Input
                  id="row-count"
                  type="number"
                  min={1}
                  max={20}
                  value={rowCount}
                  onChange={(e) =>
                    setRowCount(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))
                  }
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Nomes dos Cabeçalhos</Label>
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1 border rounded-md p-2 bg-slate-50/50 dark:bg-slate-900/50">
                {Array.from({ length: columnCount }).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-semibold text-muted-foreground w-12 shrink-0">
                      Col. {idx + 1}:
                    </span>
                    <Input
                      value={columnHeaders[idx] ?? ''}
                      onChange={(e) => handleHeaderNameChange(idx, e.target.value)}
                      placeholder={
                        idx === 0
                          ? 'Item / Componente'
                          : idx === 1
                            ? 'Descrição / Especificação'
                            : idx === 2
                              ? 'Observação'
                              : `Coluna ${idx + 1}`
                      }
                      className="h-8 text-xs bg-white dark:bg-slate-900"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Preview visual da tabela */}
            <div className="rounded border bg-white dark:bg-slate-950 p-2 overflow-x-auto">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">
                Pré-visualização
              </div>
              <table className="w-full border-collapse border border-slate-200 text-[10px]">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold">
                    {Array.from({ length: columnCount }).map((_, i) => (
                      <th
                        key={i}
                        className="border border-slate-200 p-1 text-left truncate max-w-[120px]"
                      >
                        {columnHeaders[i]?.trim() || `Col. ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {Array.from({ length: columnCount }).map((_, i) => (
                      <td key={i} className="border border-slate-200 p-1 text-slate-500">
                        {i === 0 ? '1' : '...'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTableDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-[#0b3c26] hover:bg-[#0b3c26]/90 text-white"
              onClick={handleConfirmInsertTable}
            >
              Inserir Tabela
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor Body */}
      {isSourceView ? (
        <textarea
          value={sourceCode}
          onChange={handleSourceCodeChange}
          placeholder="Código HTML..."
          className={cn(
            'w-full flex-1 p-3 font-mono text-xs text-slate-800 dark:text-slate-200 bg-slate-900/5 dark:bg-slate-950 resize-y outline-none leading-relaxed',
            minHeight,
            isFullscreen && 'flex-1 h-full resize-none',
          )}
          spellCheck={false}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onBlur={handleInput}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          className={cn(
            'rich-text-content w-full flex-1 p-3.5 outline-none text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-relaxed overflow-y-auto bg-white dark:bg-slate-900 prose prose-sm max-w-none dark:prose-invert',
            minHeight,
            isFullscreen && 'flex-1 h-full',
          )}
          data-placeholder={placeholder}
          style={{ ['--tw-prose-bullets' as string]: '#0b3c26' }}
          suppressContentEditableWarning
        />
      )}
    </div>
  )
}
