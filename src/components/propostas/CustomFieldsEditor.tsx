import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export interface CustomField {
  titulo: string
  conteudo: string
}

interface CustomFieldsEditorProps {
  fields: CustomField[]
  onChange: (fields: CustomField[]) => void
}

export function CustomFieldsEditor({ fields, onChange }: CustomFieldsEditorProps) {
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null)

  const addField = () => {
    onChange([...fields, { titulo: '', conteudo: '' }])
  }

  const updateField = (index: number, key: keyof CustomField, value: string) => {
    const updated = fields.map((f, i) => (i === index ? { ...f, [key]: value } : f))
    onChange(updated)
  }

  const removeField = (index: number) => {
    const field = fields[index]
    if (field && (field.titulo.trim() || field.conteudo.trim())) {
      setConfirmIndex(index)
    } else {
      onChange(fields.filter((_, i) => i !== index))
    }
  }

  const confirmRemove = () => {
    if (confirmIndex !== null) {
      onChange(fields.filter((_, i) => i !== confirmIndex))
      setConfirmIndex(null)
    }
  }

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 p-3 rounded-md border bg-slate-50/50 dark:bg-slate-900/30"
        >
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 sr-only">
                Nome do campo personalizado {index + 1}
              </Label>
              <Input
                placeholder="Nome do campo (ex: Norma específica, Exigência do edital)"
                value={field.titulo}
                onChange={(e) => updateField(index, 'titulo', e.target.value)}
                aria-label={`Nome do campo personalizado ${index + 1}`}
                className="text-xs font-semibold"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeField(index)}
              aria-label={`Remover campo ${index + 1}`}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <Textarea
            placeholder="Valor do campo"
            value={field.conteudo}
            onChange={(e) => updateField(index, 'conteudo', e.target.value)}
            aria-label={`Valor do campo personalizado ${index + 1}`}
            className="text-xs"
            rows={2}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addField}
        className="gap-1.5 text-xs w-full border-dashed"
      >
        <Plus className="w-3.5 h-3.5" />
        Adicionar Campo
      </Button>

      <AlertDialog
        open={confirmIndex !== null}
        onOpenChange={(open) => !open && setConfirmIndex(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover campo personalizado?</AlertDialogTitle>
            <AlertDialogDescription>
              Este campo já possui conteúdo preenchido. Deseja realmente removê-lo? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
