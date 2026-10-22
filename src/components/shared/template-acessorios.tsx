import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Package, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'

interface Acessorio {
  id: string
  nome: string
  tipo: string | null
  valor: number | null
  moeda: string | null
}
interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  onApply: (selected: Acessorio[]) => void
  versaoId?: string
}

export function TemplateAcessorios({ open, onOpenChange, onApply, versaoId }: Props) {
  const [acessorios, setAcessorios] = useState<Acessorio[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('acessorios')
      .select('id, nome, tipo, valor, moeda')
      .eq('status', 'Ativo')
      .order('nome')
    if (versaoId) q = q.contains('versoes', [versaoId])
    const { data } = await q
    setAcessorios((data ?? []) as Acessorio[])
    setLoading(false)
  }, [versaoId])

  useEffect(() => {
    if (open) {
      load()
      setSelected(new Set())
    }
  }, [open, load])

  const toggle = (id: string) =>
    setSelected((p) => {
      const n = new Set(p)
      if (n.has(id)) {
        n.delete(id)
      } else {
        n.add(id)
      }
      return n
    })
  const apply = () => {
    const selectedItems = acessorios.filter((a) => selected.has(a.id))
    onApply(selectedItems)
    toast({ title: `${selectedItems.length} acessório(s) aplicado(s)!` })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-4 h-4" /> Template de Acessórios
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-64 pr-4">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
          ) : acessorios.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhum acessório disponível.
            </p>
          ) : (
            <div className="space-y-2">
              {acessorios.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                  onClick={() => toggle(a.id)}
                >
                  <Checkbox checked={selected.has(a.id)} />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{a.nome}</span>
                    {a.tipo && (
                      <Badge variant="secondary" className="text-[10px] ml-2">
                        {a.tipo}
                      </Badge>
                    )}
                  </div>
                  {a.valor != null && (
                    <span className="text-xs font-mono text-muted-foreground">
                      {a.moeda === 'USD' ? '$' : a.moeda === 'EUR' ? '€' : 'R$'}{' '}
                      {a.valor.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={apply} disabled={selected.size === 0} className="bg-primary gap-2">
            <Check className="w-4 h-4" /> Aplicar ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
