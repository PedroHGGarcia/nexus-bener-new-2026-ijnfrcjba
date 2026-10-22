import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { FormattedNumberInput } from '@/components/shared/formatted-number-input'
import { ESTADOS_BR, getIcmsRate, IPI_DEFAULT_RATE } from '@/lib/tax-rates'
import { TaxConfig } from '@/types/licitacao-tax'
import { MapPin, Receipt, TrendingUp } from 'lucide-react'

interface Props {
  config: TaxConfig
  onChange: (config: TaxConfig) => void
  moeda: string
}

export function LicitacaoTaxConfig({ config, onChange, moeda }: Props) {
  const upd = (key: keyof TaxConfig, value: unknown) => onChange({ ...config, [key]: value })

  const icmsRate = config.estadoFaturamento ? getIcmsRate(config.estadoFaturamento) : 0
  const showCambio = moeda !== 'BRL'

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b pb-2 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          Configuração Fiscal e Câmbio
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              <MapPin className="w-3 h-3 inline mr-1" />
              Estado de Faturamento
            </Label>
            <Select
              value={config.estadoFaturamento || undefined}
              onValueChange={(v) => upd('estadoFaturamento', v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="-- Selecione --" />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_BR.map((e) => (
                  <SelectItem key={e.uf} value={e.uf}>
                    {e.uf} — {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {config.estadoFaturamento && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                ICMS: {icmsRate}% • IPI: {IPI_DEFAULT_RATE}%
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Regime de Preço
            </Label>
            <Select
              value={config.regimePreco}
              onValueChange={(v) => upd('regimePreco', v as 'embutido' | 'liquido')}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="embutido">Impostos Embutidos</SelectItem>
                <SelectItem value="liquido">Preço Líquido (impostos destacados)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showCambio && (
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                <TrendingUp className="w-3 h-3 inline mr-1" />
                Câmbio Estimado (opcional)
              </Label>
              <FormattedNumberInput
                className="mt-1"
                value={config.cambioEstimado || 0}
                onChange={(v) => upd('cambioEstimado', v || null)}
                placeholder="Ex: 5.15"
              />
              <Input
                type="date"
                className="mt-1 h-8 text-xs"
                value={config.cambioEstimadoData}
                onChange={(e) => upd('cambioEstimadoData', e.target.value)}
              />
              <Input
                type="text"
                className="mt-1 h-8 text-xs"
                placeholder="Base de referência (ex: PTAX, Bloomberg)"
                value={config.cambioEstimadoBase}
                onChange={(e) => upd('cambioEstimadoBase', e.target.value)}
              />
            </div>
          )}
        </div>

        {config.regimePreco === 'liquido' && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Preço Líquido:</strong> Os impostos (IPI e ICMS) serão calculados e destacados
              separadamente do valor do produto na memória de cálculo completa.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
