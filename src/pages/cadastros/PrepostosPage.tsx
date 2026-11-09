import { useState, useEffect } from 'react'
import { benerStore } from '@/services/store'
import { Preposto } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Edit } from 'lucide-react'

export default function PrepostosPage() {
  const [prepostos, setPrepostos] = useState<Preposto[]>(benerStore.prepostos)
  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Preposto>>({})

  useEffect(() => {
    const unsub = benerStore.subscribe(() => setPrepostos([...benerStore.prepostos]))
    return () => {
      unsub()
    }
  }, [])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    benerStore.saveItem<Preposto>('prepostos', 'prepostos', editing)
    setOpenModal(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Prepostos e Procuradores</h1>
        <Button
          onClick={() => {
            setEditing({})
            setOpenModal(true)
          }}
          className="bg-primary gap-1"
        >
          <Plus className="w-4 h-4" /> Novo Preposto
        </Button>
      </div>

      <div className="border rounded-lg bg-card overflow-x-auto shadow-sm">
        <Table className="w-full table-fixed">
          <colgroup>
            <col className="w-[35%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[25%]" />
            <col className="w-[80px]" />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="py-3 px-3">Nome</TableHead>
              <TableHead className="py-3 px-3 whitespace-nowrap">Documento (CPF)</TableHead>
              <TableHead className="py-3 px-3 whitespace-nowrap">Telefone</TableHead>
              <TableHead className="py-3 px-3">Região</TableHead>
              <TableHead className="text-right py-3 px-3 whitespace-nowrap">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prepostos.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-semibold py-2.5 px-3 truncate" title={p.nome}>
                  {p.nome}
                </TableCell>
                <TableCell className="text-xs font-mono py-2.5 px-3 truncate" title={p.documento}>
                  {p.documento}
                </TableCell>
                <TableCell className="text-xs py-2.5 px-3 whitespace-nowrap">
                  {p.telefone}
                </TableCell>
                <TableCell className="text-xs py-2.5 px-3 truncate" title={p.regiao}>
                  {p.regiao}
                </TableCell>
                <TableCell className="text-right py-2.5 px-3 whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditing(p)
                      setOpenModal(true)
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => benerStore.deleteItem('prepostos', 'prepostos', p.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastro de Preposto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <Label>Nome Completo</Label>
              <Input
                value={editing.nome || ''}
                onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>CPF</Label>
              <Input
                value={editing.documento || ''}
                onChange={(e) => setEditing({ ...editing, documento: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={editing.telefone || ''}
                onChange={(e) => setEditing({ ...editing, telefone: e.target.value })}
              />
            </div>
            <div>
              <Label>Região</Label>
              <Input
                value={editing.regiao || ''}
                onChange={(e) => setEditing({ ...editing, regiao: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="bg-primary">
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
