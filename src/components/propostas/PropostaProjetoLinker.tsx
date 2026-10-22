import { useMemo } from 'react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { FolderPlus, FolderSearch, Building2, AlertCircle } from 'lucide-react'
import { ProjetoWithRelations } from '@/types/projeto'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Props {
  mode: 'new' | 'existing'
  onModeChange: (mode: 'new' | 'existing') => void
  novoProjetoNome: string
  onNovoProjetoNomeChange: (v: string) => void
  novoProjetoDescricao: string
  onNovoProjetoDescricaoChange: (v: string) => void
  projetoExistenteId: string
  onProjetoExistenteIdChange: (v: string) => void
  projetos: ProjetoWithRelations[]
  clienteId: string | null
  disabled?: boolean
  error?: string | null
  id?: string
}

export function PropostaProjetoLinker({
  mode,
  onModeChange,
  novoProjetoNome,
  onNovoProjetoNomeChange,
  novoProjetoDescricao,
  onNovoProjetoDescricaoChange,
  projetoExistenteId,
  onProjetoExistenteIdChange,
  projetos,
  clienteId,
  disabled,
  error,
  id = 'secao-associacao-projeto',
}: Props) {
  const sortedProjetos = useMemo(() => {
    if (!clienteId) return projetos
    return [...projetos].sort((a, b) => {
      const aMatch = a.cliente === clienteId ? 0 : 1
      const bMatch = b.cliente === clienteId ? 0 : 1
      return aMatch - bMatch
    })
  }, [projetos, clienteId])

  return (
    <Card
      id={id}
      className={`transition-all duration-300 ${
        error ? 'border-destructive ring-2 ring-destructive/30 bg-destructive/[0.02]' : ''
      }`}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              Associação de Projeto
              <span
                className="text-destructive font-bold text-base leading-none"
                title="Obrigatório"
              >
                *
              </span>
            </h3>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded">
            Obrigatório para emissão
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          A associação a um projeto é <strong>obrigatória</strong> para emitir a proposta. Vincule a
          um projeto já cadastrado ou crie um novo projeto automaticamente.
        </p>

        {error && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-2 text-xs font-medium animate-in fade-in-50 duration-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <RadioGroup
          value={mode}
          onValueChange={(v) => onModeChange(v as 'new' | 'existing')}
          disabled={disabled}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <label
            className={`flex items-start gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${mode === 'new' ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'}`}
          >
            <RadioGroupItem value="new" className="mt-0.5" />
            <div>
              <span className="text-sm font-medium flex items-center gap-1">
                <FolderPlus className="w-3.5 h-3.5" /> Criar novo projeto
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">Crie e vincule automaticamente</p>
            </div>
          </label>

          <label
            className={`flex items-start gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${mode === 'existing' ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'}`}
          >
            <RadioGroupItem value="existing" className="mt-0.5" />
            <div>
              <span className="text-sm font-medium flex items-center gap-1">
                <FolderSearch className="w-3.5 h-3.5" /> Vincular existente
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Selecione um projeto cadastrado
              </p>
            </div>
          </label>
        </RadioGroup>

        {mode === 'new' && (
          <div className="space-y-3 pt-2 border-t">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                Nome do Projeto <span className="text-destructive font-bold">*</span>
              </Label>
              <Input
                className={`mt-1 ${error && !novoProjetoNome.trim() ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                value={novoProjetoNome}
                onChange={(e) => onNovoProjetoNomeChange(e.target.value)}
                placeholder="Ex.: Projeto Linha de Produção 2026..."
                disabled={disabled}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Descrição
              </Label>
              <Textarea
                className="mt-1"
                rows={2}
                value={novoProjetoDescricao}
                onChange={(e) => onNovoProjetoDescricaoChange(e.target.value)}
                placeholder="Descrição do projeto (opcional)..."
                disabled={disabled}
              />
            </div>
            {clienteId && (
              <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded p-2">
                O projeto será associado ao cliente selecionado na proposta.
              </p>
            )}
          </div>
        )}

        {mode === 'existing' && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              Selecione o Projeto <span className="text-destructive font-bold">*</span>
            </Label>
            <Select
              value={projetoExistenteId || undefined}
              onValueChange={onProjetoExistenteIdChange}
              disabled={disabled}
            >
              <SelectTrigger
                className={`mt-1 ${error && !projetoExistenteId ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              >
                <SelectValue placeholder="Selecione um projeto cadastrado..." />
              </SelectTrigger>
              <SelectContent>
                {sortedProjetos.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    Nenhum projeto encontrado
                  </SelectItem>
                ) : (
                  sortedProjetos.map((p) => {
                    const creatorName =
                      p.creator?.name || (p.user && !UUID_REGEX.test(p.user) ? p.user : null)
                    const creatorCargo = p.creator?.cargo || null

                    return (
                      <SelectItem key={p.id} value={p.id}>
                        <span>
                          {p.nome}
                          {p.clientes?.fantasia ? ` • ${p.clientes.fantasia}` : ''}
                          {creatorName && (
                            <span className="text-xs text-muted-foreground font-normal">
                              {` — ${creatorName}${creatorCargo ? ` (${creatorCargo})` : ''}`}
                            </span>
                          )}
                          {clienteId && p.cliente === clienteId ? ' ★' : ''}
                        </span>
                      </SelectItem>
                    )
                  })
                )}
              </SelectContent>
            </Select>
            {clienteId && (
              <p className="text-xs text-muted-foreground">
                Projetos do cliente selecionado são destacados com ★.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
