import { useState, useRef } from 'react'
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Columns,
  CornerDownRight,
  ImagePlus,
  Loader2,
  X,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TechnicalTableData, TechnicalTableRow, generateId } from '@/lib/technical-table'
import { uploadVersaoImage } from '@/services/versoes'
import { toast } from '@/hooks/use-toast'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface EditableTechnicalTableProps {
  title: string
  description?: string
  data: TechnicalTableData
  onChange: (data: TechnicalTableData) => void
  disabled?: boolean
}

export function EditableTechnicalTable({
  title,
  description,
  data,
  onChange,
  disabled = false,
}: EditableTechnicalTableProps) {
  const [newColumnName, setNewColumnName] = useState('')
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [editingColumnLabel, setEditingColumnLabel] = useState('')
  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null)
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeRowIdForUploadRef = useRef<string | null>(null)

  const handleCellChange = (rowId: string, colId: string, value: string) => {
    const newRows = data.rows.map((row) => {
      if (row.id === rowId) {
        return {
          ...row,
          values: {
            ...row.values,
            [colId]: value,
          },
        }
      }
      return row
    })
    onChange({
      ...data,
      rows: newRows,
    })
  }

  const handleAddRow = () => {
    const newRow: TechnicalTableRow = {
      id: generateId(),
      values: {},
      imagem: null,
    }
    // Auto-preenche o primeiro campo ("Item") com o próximo número sequencial se existir
    if (data.columns[0]?.id === 'item') {
      newRow.values['item'] = String(data.rows.length + 1)
    }
    onChange({
      ...data,
      rows: [...data.rows, newRow],
    })
  }

  const handleDeleteRow = (index: number) => {
    const newRows = data.rows.filter((_, i) => i !== index)
    onChange({
      ...data,
      rows: newRows,
    })
  }

  const handleMoveRow = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= data.rows.length) return
    const newRows = [...data.rows]
    const temp = newRows[index]
    newRows[index] = newRows[targetIndex]
    newRows[targetIndex] = temp
    onChange({
      ...data,
      rows: newRows,
    })
  }

  const handleAddColumn = () => {
    const trimmed = newColumnName.trim()
    if (!trimmed) return
    const newColId = generateId()
    onChange({
      columns: [...data.columns, { id: newColId, label: trimmed }],
      rows: data.rows,
    })
    setNewColumnName('')
    setShowAddColumn(false)
  }

  const handleStartEditColumn = (colId: string, currentLabel: string) => {
    setEditingColumnId(colId)
    setEditingColumnLabel(currentLabel)
  }

  const handleSaveEditColumn = (colId: string) => {
    const trimmed = editingColumnLabel.trim()
    if (trimmed) {
      onChange({
        columns: data.columns.map((col) => (col.id === colId ? { ...col, label: trimmed } : col)),
        rows: data.rows,
      })
    }
    setEditingColumnId(null)
  }

  const handleDeleteColumn = (colId: string) => {
    if (data.columns.length <= 1) return
    onChange({
      columns: data.columns.filter((c) => c.id !== colId),
      rows: data.rows.map((r) => {
        const nextVals = { ...r.values }
        delete nextVals[colId]
        return { ...r, values: nextVals }
      }),
    })
  }

  const handleTriggerRowImageUpload = (rowId: string) => {
    activeRowIdForUploadRef.current = rowId
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const rowId = activeRowIdForUploadRef.current
    if (!file || !rowId) return

    setUploadingRowId(rowId)
    try {
      const url = await uploadVersaoImage(file)
      if (url) {
        const newRows = data.rows.map((r) => (r.id === rowId ? { ...r, imagem: url } : r))
        onChange({
          ...data,
          rows: newRows,
        })
        toast({
          title: 'Imagem anexada ao item',
          description: 'A foto foi enviada e associada a esta linha técnica.',
        })
      }
    } catch (err) {
      toast({
        title: 'Erro no envio da foto',
        description: err instanceof Error ? err.message : 'Falha ao enviar imagem',
        variant: 'destructive',
      })
    } finally {
      setUploadingRowId(null)
      activeRowIdForUploadRef.current = null
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveRowImage = (rowId: string) => {
    const newRows = data.rows.map((r) => (r.id === rowId ? { ...r, imagem: null } : r))
    onChange({
      ...data,
      rows: newRows,
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {!disabled && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddColumn((prev) => !prev)}
                className="h-8 gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300"
              >
                <Columns className="h-3.5 w-3.5" />
                Nova Coluna
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddRow}
                className="h-8 gap-1.5 bg-[#0b3c26] text-xs text-white hover:bg-[#0b3c26]/90"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar Linha
              </Button>
            </>
          )}
        </div>
      </div>

      {showAddColumn && !disabled && (
        <div className="flex items-center gap-2 rounded-md bg-slate-50 p-2.5 border border-slate-200 dark:bg-slate-800/60 dark:border-slate-700">
          <Input
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            placeholder="Nome da nova coluna (ex: Unidade, Tolerância)..."
            className="h-8 text-xs max-w-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddColumn()
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddColumn}
            className="h-8 bg-[#0b3c26] text-xs text-white hover:bg-[#0b3c26]/90"
          >
            Adicionar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAddColumn(false)}
            className="h-8 text-xs text-muted-foreground"
          >
            Cancelar
          </Button>
        </div>
      )}

      {/* Tabela Interativa Estilo Excel / Planilha */}
      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200">
              <th className="w-10 px-2 py-2 text-center text-[11px] font-semibold text-slate-500">
                #
              </th>
              <th className="w-20 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Foto
              </th>
              {data.columns.map((col, cIdx) => (
                <th
                  key={col.id}
                  className={`px-3 py-2 text-[11px] font-semibold tracking-wide uppercase ${
                    cIdx === 0 ? 'w-24' : cIdx === 1 ? 'min-w-[220px]' : 'min-w-[160px]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 group">
                    {editingColumnId === col.id && !disabled ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingColumnLabel}
                          onChange={(e) => setEditingColumnLabel(e.target.value)}
                          onBlur={() => handleSaveEditColumn(col.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEditColumn(col.id)
                          }}
                          autoFocus
                          className="h-6 w-28 text-[11px] px-1 py-0"
                        />
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:underline"
                        title={disabled ? undefined : 'Clique duplo para renomear'}
                        onDoubleClick={() => !disabled && handleStartEditColumn(col.id, col.label)}
                      >
                        {col.label}
                      </span>
                    )}

                    {!disabled && data.columns.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn(col.id)}
                        title="Remover coluna"
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-opacity p-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              {!disabled && (
                <th className="w-24 px-2 py-2 text-center text-[11px] font-semibold text-slate-500">
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {data.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={data.columns.length + (disabled ? 2 : 3)}
                  className="py-8 text-center text-xs text-muted-foreground italic"
                >
                  Nenhuma linha adicionada.{' '}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="text-[#0b3c26] underline font-medium hover:text-[#0b3c26]/80 ml-1 inline-flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3 inline" /> Clique aqui para adicionar a primeira
                      linha
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              data.rows.map((row, rIdx) => (
                <tr
                  key={row.id}
                  className="group hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-2 py-1.5 text-center font-mono text-[11px] text-slate-400 select-none">
                    {rIdx + 1}
                  </td>
                  {/* Célula de Imagem da Linha */}
                  <td className="p-1 text-center align-middle">
                    {row.imagem ? (
                      <div className="relative inline-flex items-center justify-center group/img">
                        <button
                          type="button"
                          onClick={() => setZoomImageUrl(row.imagem || null)}
                          title="Clique para ampliar"
                          className="h-10 w-12 rounded border border-slate-200 bg-slate-50 p-0.5 overflow-hidden flex items-center justify-center hover:border-[#0b3c26] transition-colors"
                        >
                          <img
                            src={row.imagem}
                            alt="Foto do item"
                            className="h-full w-full object-contain"
                            loading="lazy"
                          />
                        </button>
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRowImage(row.id)}
                            title="Remover foto"
                            className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity shadow-xs hover:bg-red-700"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      !disabled && (
                        <button
                          type="button"
                          disabled={uploadingRowId === row.id}
                          onClick={() => handleTriggerRowImageUpload(row.id)}
                          title="Inserir foto neste item"
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-[#0b3c26] hover:bg-emerald-50 dark:hover:bg-slate-800 p-1 rounded border border-dashed border-slate-300 dark:border-slate-700 transition-colors"
                        >
                          {uploadingRowId === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0b3c26]" />
                          ) : (
                            <ImagePlus className="h-3.5 w-3.5" />
                          )}
                          <span>+ Foto</span>
                        </button>
                      )
                    )}
                  </td>
                  {data.columns.map((col, cIdx) => (
                    <td key={col.id} className="p-1">
                      <Input
                        disabled={disabled}
                        value={row.values[col.id] ?? ''}
                        onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
                        placeholder={
                          cIdx === 0
                            ? `${rIdx + 1}`
                            : cIdx === 1
                              ? 'Descrição do item...'
                              : 'Observação ou valor...'
                        }
                        className={`h-8 border-transparent hover:border-slate-300 focus:border-[#0b3c26] focus:ring-1 focus:ring-[#0b3c26] text-xs transition-colors rounded-xs bg-transparent focus:bg-white dark:focus:bg-slate-900 ${
                          cIdx === 0 ? 'font-medium' : ''
                        }`}
                      />
                    </td>
                  ))}
                  {!disabled && (
                    <td className="px-2 py-1 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleMoveRow(rIdx, 'up')}
                          disabled={rIdx === 0}
                          title="Mover para cima"
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveRow(rIdx, 'down')}
                          disabled={rIdx === data.rows.length - 1}
                          title="Mover para baixo"
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(rIdx)}
                          title="Excluir linha"
                          className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data.rows.length > 0 && !disabled && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
          <span>
            {data.rows.length} {data.rows.length === 1 ? 'linha' : 'linhas'} • {data.columns.length}{' '}
            colunas
          </span>
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-1 text-[#0b3c26] hover:underline font-medium"
          >
            <CornerDownRight className="h-3 w-3" /> Adicionar nova linha
          </button>
        </div>
      )}

      {/* Input de arquivo invisível reutilizado para upload de fotos das linhas */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Modal para Visualização / Zoom da Imagem da Linha */}
      <Dialog open={!!zoomImageUrl} onOpenChange={(open) => !open && setZoomImageUrl(null)}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-white dark:bg-slate-900 border">
          <div className="p-3 border-b flex items-center justify-between bg-slate-50 dark:bg-slate-800">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Foto do Item Técnico
            </span>
            {zoomImageUrl && (
              <a
                href={zoomImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#0b3c26] hover:underline flex items-center gap-1 font-medium mr-6"
              >
                <ExternalLink className="h-3 w-3" /> Abrir original
              </a>
            )}
          </div>
          <div className="p-4 flex items-center justify-center max-h-[70vh] overflow-auto">
            {zoomImageUrl && (
              <img
                src={zoomImageUrl}
                alt="Foto ampliada do item"
                className="max-h-[60vh] max-w-full object-contain rounded border bg-white p-1"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
