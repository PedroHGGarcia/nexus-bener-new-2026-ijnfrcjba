import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { UserPlus, Trash2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { LoadingState, EmptyState } from '@/components/StateViews'
import { ProjetoMembroWithProfile, PAPEL_OPTIONS } from '@/types/projeto-membro'
import { fetchMembros, updateMembroPapel, removeMembro } from '@/services/projeto-membros'
import { AddMemberDialog } from '@/components/projetos/AddMemberDialog'
import { formatDate } from '@/lib/format'

export function TeamMembersSection({ projetoId }: { projetoId: string }) {
  const [members, setMembers] = useState<ProjetoMembroWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setMembers(await fetchMembros(projetoId))
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => {
    load()
  }, [load])

  const sorted = [...members].sort((a, b) => {
    if (a.papel === 'Criador' && b.papel !== 'Criador') return -1
    if (a.papel !== 'Criador' && b.papel === 'Criador') return 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const handleRoleChange = async (membroId: string, papel: string) => {
    try {
      await updateMembroPapel(membroId, papel)
      setMembers((prev) => prev.map((m) => (m.id === membroId ? { ...m, papel } : m)))
      toast({ title: 'Papel atualizado' })
    } catch {
      toast({ title: 'Erro ao atualizar papel', variant: 'destructive' })
    }
  }

  const handleRemove = async (membroId: string) => {
    try {
      await removeMembro(membroId)
      setMembers((prev) => prev.filter((m) => m.id !== membroId))
      toast({ title: 'Membro removido' })
    } catch {
      toast({ title: 'Erro ao remover membro', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-base">Equipe ({members.length})</CardTitle>
          <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1 bg-primary">
            <UserPlus className="w-4 h-4" /> Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingState count={2} />
        ) : sorted.length === 0 ? (
          <EmptyState title="Nenhum membro" description="Adicione membros à equipe do projeto." />
        ) : (
          <div className="space-y-2">
            {sorted.map((m) => {
              const name = m.profiles?.name ?? 'Usuário'
              const initials = name
                .split(' ')
                .map((n) => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase()
              return (
                <div key={m.id} className="flex items-center gap-3 p-3 border rounded-md">
                  <Avatar className="w-9 h-9 shrink-0">
                    {m.profiles?.avatar_url && (
                      <AvatarImage src={m.profiles.avatar_url} alt={name} />
                    )}
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{name}</span>
                      {m.papel === 'Criador' && (
                        <Badge variant="secondary" className="text-xs">
                          Criador
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{m.profiles?.email ?? '—'}</span>
                      <span>•</span>
                      <span>Desde {formatDate(m.created_at)}</span>
                    </div>
                  </div>
                  {m.papel !== 'Criador' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Select value={m.papel} onValueChange={(v) => handleRoleChange(m.id, v)}>
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAPEL_OPTIONS.filter((p) => p.value !== 'Criador').map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRemove(m.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
      <AddMemberDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        projetoId={projetoId}
        existingMemberIds={members.map((m) => m.user_id)}
        onAdded={load}
      />
    </Card>
  )
}
