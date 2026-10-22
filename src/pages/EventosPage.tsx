import { useState, useEffect, useCallback } from 'react'
import {
  fetchEventos,
  insertEvento,
  updateEvento,
  deleteEvento,
  type Evento,
} from '@/services/eventos'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, Plus, MapPin, Clock, Edit, Trash2 } from 'lucide-react'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { toast } from '@/hooks/use-toast'

const STATUS_OPTIONS = ['Agendado', 'Em Andamento', 'Concluído', 'Cancelado']

const emptyForm: Partial<Evento> = {
  titulo: '',
  descricao: '',
  data_inicio: '',
  data_fim: '',
  local: '',
  status: 'Agendado',
}

export default function EventosPage() {
  const [events, setEvents] = useState<Evento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [openModal, setOpenModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Evento>>(emptyForm)
  const [saving, setSaving] = useState(false)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchEventos()
      setEvents(data)
    } catch {
      setError(true)
      toast({ title: 'Erro ao carregar eventos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setOpenModal(true)
  }

  const openEdit = (evt: Evento) => {
    setForm({
      ...evt,
      data_inicio: evt.data_inicio ? evt.data_inicio.slice(0, 16) : '',
      data_fim: evt.data_fim ? evt.data_fim.slice(0, 16) : '',
    })
    setEditingId(evt.id)
    setOpenModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.titulo?.trim()) {
      toast({ title: 'Título é obrigatório', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao || null,
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || null,
        local: form.local || null,
        status: form.status || 'Agendado',
      }
      if (editingId) {
        await updateEvento(editingId, payload)
        toast({ title: 'Evento atualizado com sucesso' })
      } else {
        await insertEvento(payload)
        toast({ title: 'Evento criado com sucesso' })
      }
      setOpenModal(false)
      loadEvents()
    } catch (err) {
      toast({
        title: 'Erro ao salvar evento',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deseja realmente excluir este evento?')) return
    try {
      await deleteEvento(id)
      toast({ title: 'Evento excluído' })
      loadEvents()
    } catch {
      toast({ title: 'Erro ao excluir evento', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Agenda de Eventos & Visitas</h1>
          <p className="text-sm text-muted-foreground">
            Agendamentos técnicos, reuniões e manutenções
          </p>
        </div>
        <Button onClick={openCreate} className="bg-primary gap-1">
          <Plus className="w-4 h-4" /> Novo Evento
        </Button>
      </div>

      {loading ? (
        <LoadingState count={4} />
      ) : error ? (
        <ErrorState message="Erro ao carregar eventos." onRetry={loadEvents} />
      ) : events.length === 0 ? (
        <EmptyState
          title="Nenhum evento encontrado"
          description="Não há eventos agendados no momento."
          actionText="Novo Evento"
          onAction={openCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((evt) => (
            <Card key={evt.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <Badge
                    variant={
                      evt.status === 'Cancelado'
                        ? 'destructive'
                        : evt.status === 'Concluído'
                          ? 'secondary'
                          : 'default'
                    }
                  >
                    {evt.status || 'Agendado'}
                  </Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(evt)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(evt.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-base mt-2">{evt.titulo}</CardTitle>
                {evt.descricao && (
                  <CardDescription className="text-xs line-clamp-2">
                    {evt.descricao}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="text-xs space-y-1.5 pt-0 text-muted-foreground">
                {evt.data_inicio && (
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <Clock className="w-3.5 h-3.5 text-primary" />{' '}
                    {new Date(evt.data_inicio).toLocaleString('pt-BR')}
                  </div>
                )}
                {evt.local && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" /> {evt.local}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Evento' : 'Agendar Evento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <Label>Título do Evento</Label>
              <Input
                value={form.titulo || ''}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao || ''}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input
                  type="datetime-local"
                  value={form.data_inicio || ''}
                  onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input
                  type="datetime-local"
                  value={form.data_fim || ''}
                  onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Local</Label>
              <Input
                value={form.local || ''}
                onChange={(e) => setForm({ ...form, local: e.target.value })}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status || 'Agendado'}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" className="bg-primary" disabled={saving}>
                {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Agendar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
