import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Lock } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { Cliente } from '@/types/cliente'
import { PROJETO_STATUS_OPTIONS, ProjectCreator } from '@/types/projeto'
import { fetchClientes } from '@/services/clientes'
import { fetchProjetoById, updateProjeto } from '@/services/projetos'
import { CreatorDisplay } from '@/components/projetos/CreatorDisplay'
import { formatDateTime } from '@/lib/format'

export default function ProjetoEditarPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])

  const [nome, setNome] = useState('')
  const [cliente, setCliente] = useState('')
  const [status, setStatus] = useState('Em Andamento')
  const [descricao, setDescricao] = useState('')
  const [ooo, setOoo] = useState('')
  const [creator, setCreator] = useState<ProjectCreator | null>(null)
  const [rawUser, setRawUser] = useState<string | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([fetchProjetoById(id), fetchClientes().catch(() => [])]).then(([proj, clients]) => {
      if (!proj) {
        toast({ title: 'Projeto não encontrado', variant: 'destructive' })
        navigate('/projetos')
        return
      }
      setNome(proj.nome)
      setCliente(proj.cliente ?? '')
      setStatus(proj.status)
      setDescricao(proj.descricao ?? '')
      setOoo(proj.ooo ?? '')
      setCreator(proj.creator ?? null)
      setRawUser(proj.user)
      setCreatedAt(proj.created_at)
      setClientes(clients)
      setLoading(false)
    })
  }, [id, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    if (!nome.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await updateProjeto(id, {
        nome: nome.trim(),
        cliente: cliente || null,
        status,
        descricao: descricao || null,
        ooo: ooo || null,
      })
      toast({ title: 'Projeto atualizado com sucesso' })
      navigate(`/projetos/${id}`)
    } catch (err) {
      toast({
        title: 'Erro ao atualizar projeto',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Editar Projeto</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg border border-border/60">
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Criado por
                </Label>
                <div className="mt-1.5" aria-label="Criador do projeto (somente leitura)">
                  <CreatorDisplay creator={creator} rawUser={rawUser} />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Criado em
                </Label>
                <div
                  className="mt-1.5 text-sm font-semibold pt-1"
                  aria-label="Data de criação (somente leitura)"
                  aria-readonly="true"
                >
                  {formatDateTime(createdAt)}
                </div>
              </div>
            </div>

            <div>
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div>
              <Label>Cliente</Label>
              <Select value={cliente} onValueChange={setCliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fantasia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJETO_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
