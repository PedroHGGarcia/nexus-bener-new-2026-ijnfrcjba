import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { List, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Acessorio } from '@/types/acessorio'
import { cn } from '@/lib/utils'

export type InclusaoType = 'preco' | 'opcional' | 'incluir' | 'exibir' | 'nao_exibir'

export interface SelectedAcessorio {
  id: string
  nome: string
  valor: number
  moeda: string
  inclusao?: InclusaoType
  quantidade?: number
  desconto_percentual?: number
  desconto_valor?: number
  versao_id?: string
}

interface Props {
  versaoId: string | null
  currency: string
  selectedAcessorios: SelectedAcessorio[]
  onChange: (items: SelectedAcessorio[]) => void
  versaoNome?: string
  hideHeaderTitle?: boolean
  precoEspecialAtivo?: boolean
}

function formatAcessorioValor(val: number | null | undefined, moeda?: string | null): string {
  const num = val ?? 0
  const m = (moeda || 'BRL').toUpperCase()
  const formatted = num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${m} ${formatted}`
}

export function PropostaAcessoriosSection({
  versaoId,
  currency,
  selectedAcessorios,
  onChange,
  versaoNome,
  hideHeaderTitle,
}: Props) {
  const [acessorios, setAcessorios] = useState<Acessorio[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!versaoId) {
      setAcessorios([])
      return
    }
    setLoading(true)
    supabase
      .from('acessorio_versoes')
      .select('acessorio_id, acessorios(*)')
      .eq('versao_id', versaoId)
      .then(({ data, error }) => {
        setLoading(false)
        if (!error && data) {
          const rows = data as Array<{
            acessorio_id: string
            acessorios: Acessorio | Acessorio[] | null
          }>
          const items: Acessorio[] = rows
            .map((r) => {
              const a = r.acessorios
              return Array.isArray(a) ? a[0] : a
            })
            .filter((a): a is Acessorio => !!a && (a.status ?? 'Ativo') === 'Ativo')

          const seen = new Set<string>()
          const deduped = items.filter((a) => {
            if (seen.has(a.id)) return false
            seen.add(a.id)
            return true
          })
          deduped.sort((a, b) => a.nome.localeCompare(b.nome))
          setAcessorios(deduped)
        } else {
          setAcessorios([])
        }
      })
  }, [versaoId])

  const getItemStatus = (id: string): 'incluir' | 'nao_exibir' | 'exibir' => {
    const sel = selectedAcessorios.find((s) => s.id === id)
    if (!sel) return 'nao_exibir'
    if (sel.inclusao === 'exibir') return 'exibir'
    if (sel.inclusao === 'nao_exibir') return 'nao_exibir'
    return 'incluir'
  }

  const handleRadioChange = (item: Acessorio, option: 'incluir' | 'nao_exibir' | 'exibir') => {
    const remaining = selectedAcessorios.filter((s) => s.id !== item.id)

    if (option === 'nao_exibir') {
      onChange(remaining)
      return
    }

    const newItem: SelectedAcessorio = {
      id: item.id,
      nome: item.nome,
      valor: item.valor || 0,
      moeda: item.moeda || currency,
      inclusao: option,
      quantidade: 1,
      desconto_percentual: 0,
      desconto_valor: 0,
      versao_id: versaoId || undefined,
    }

    onChange([...remaining, newItem])
  }

  return (
    <div className="space-y-3">
      {!hideHeaderTitle && (
        <div className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
          <List className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          <span>Acessórios {versaoNome ? `— ${versaoNome}` : ''}</span>
        </div>
      )}

      {!versaoId ? (
        <Card className="border-dashed bg-slate-50/50 dark:bg-slate-900/50">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Selecione uma versão para visualizar os acessórios disponíveis.
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Carregando acessórios...</span>
          </CardContent>
        </Card>
      ) : acessorios.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhum acessório cadastrado para esta versão.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 text-left w-[42%] min-w-[200px]">Acessório</th>
                  <th className="py-3 px-4 text-left w-[16%] min-w-[120px]">Valor</th>
                  <th className="py-3 px-3 text-center w-[14%] min-w-[130px]">
                    Incluir na Proposta
                  </th>
                  <th className="py-3 px-3 text-center w-[14%] min-w-[140px]">
                    Não exibir na Proposta
                  </th>
                  <th className="py-3 px-3 text-center w-[14%] min-w-[130px]">
                    Exibir na Proposta
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {acessorios.map((item, idx) => {
                  const currentStatus = getItemStatus(item.id)
                  const radioGroupName = `acc-opt-${versaoId || 'single'}-${item.id}`
                  const isZebra = idx % 2 === 0

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        'transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/50',
                        isZebra
                          ? 'bg-slate-50/70 dark:bg-slate-900/30'
                          : 'bg-white dark:bg-slate-950',
                      )}
                    >
                      <td className="py-2.5 px-4 font-normal text-slate-900 dark:text-slate-100">
                        {item.nome}
                      </td>
                      <td className="py-2.5 px-4 font-normal text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatAcessorioValor(item.valor, item.moeda || currency)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <label
                          htmlFor={`${radioGroupName}-incluir`}
                          className="inline-flex items-center justify-center p-1 cursor-pointer"
                        >
                          <input
                            type="radio"
                            id={`${radioGroupName}-incluir`}
                            name={radioGroupName}
                            value="incluir"
                            checked={currentStatus === 'incluir'}
                            onChange={() => handleRadioChange(item, 'incluir')}
                            className="h-4 w-4 text-primary accent-primary cursor-pointer transition-transform hover:scale-110"
                          />
                          <span className="sr-only">Incluir na Proposta {item.nome}</span>
                        </label>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <label
                          htmlFor={`${radioGroupName}-nao_exibir`}
                          className="inline-flex items-center justify-center p-1 cursor-pointer"
                        >
                          <input
                            type="radio"
                            id={`${radioGroupName}-nao_exibir`}
                            name={radioGroupName}
                            value="nao_exibir"
                            checked={currentStatus === 'nao_exibir'}
                            onChange={() => handleRadioChange(item, 'nao_exibir')}
                            className="h-4 w-4 text-primary accent-primary cursor-pointer transition-transform hover:scale-110"
                          />
                          <span className="sr-only">Não exibir na Proposta {item.nome}</span>
                        </label>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <label
                          htmlFor={`${radioGroupName}-exibir`}
                          className="inline-flex items-center justify-center p-1 cursor-pointer"
                        >
                          <input
                            type="radio"
                            id={`${radioGroupName}-exibir`}
                            name={radioGroupName}
                            value="exibir"
                            checked={currentStatus === 'exibir'}
                            onChange={() => handleRadioChange(item, 'exibir')}
                            className="h-4 w-4 text-primary accent-primary cursor-pointer transition-transform hover:scale-110"
                          />
                          <span className="sr-only">Exibir na Proposta {item.nome}</span>
                        </label>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
