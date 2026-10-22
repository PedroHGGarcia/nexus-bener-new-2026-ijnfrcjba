import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { searchProfiles, addMembro } from '@/services/projeto-membros'
import { PAPEL_OPTIONS } from '@/types/projeto-membro'

interface ProfileResult {
  id: string
  name: string
  email: string
  avatar_url: string | null
  role: string | null
}

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  projetoId: string
  existingMemberIds: string[]
  onAdded: () => void
}

export function AddMemberDialog({
  open,
  onOpenChange,
  projetoId,
  existingMemberIds,
  onAdded,
}: Props) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [results, setResults] = useState<ProfileResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<ProfileResult | null>(null)
  const [papel, setPapel] = useState('Colaborador')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const doSearch = useCallback(async () => {
    if (!debounced.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      setResults(await searchProfiles(debounced.trim(), existingMemberIds))
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [debounced, existingMemberIds])

  useEffect(() => {
    doSearch()
  }, [doSearch])

  useEffect(() => {
    if (open) {
      setSearch('')
      setSelected(null)
      setPapel('Colaborador')
      setResults([])
    }
  }, [open])

  const handleAdd = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await addMembro(projetoId, selected.id, papel)
      toast({ title: 'Membro adicionado com sucesso' })
      onOpenChange(false)
      onAdded()
    } catch (err) {
      toast({
        title: 'Erro ao adicionar membro',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Membro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && results.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {results.map((r) => {
                const initials = r.name
                  .split(' ')
                  .map((n) => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelected(r)}
                    className={`w-full flex items-center gap-3 p-2 rounded-md border transition-colors ${selected?.id === r.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}
                  >
                    <Avatar className="w-8 h-8 shrink-0">
                      {r.avatar_url && <AvatarImage src={r.avatar_url} alt={r.name} />}
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          {!loading && search.trim() && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum usuário encontrado.
            </p>
          )}
          {selected && (
            <div>
              <Label className="text-xs">Papel</Label>
              <Select value={papel} onValueChange={setPapel}>
                <SelectTrigger className="mt-1">
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
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAdd} disabled={!selected || saving} className="bg-primary">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
