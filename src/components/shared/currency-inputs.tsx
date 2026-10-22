import { useState, useEffect, useCallback, ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const CURRENCY_CONFIG: Record<string, { locale: string; code: string; symbol: string }> = {
  BRL: { locale: 'pt-BR', code: 'BRL', symbol: 'R$' },
  USD: { locale: 'en-US', code: 'USD', symbol: '$' },
  EUR: { locale: 'de-DE', code: 'EUR', symbol: '€' },
}

export function formatCurrencyValue(value: number, currency: string): string {
  const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.BRL
  return new Intl.NumberFormat(cfg.locale, { style: 'currency', currency: cfg.code }).format(
    value || 0,
  )
}

interface CurrencyInputProps {
  value: number
  onChange: (value: number) => void
  currency?: string
  disabled?: boolean
  className?: string
  placeholder?: string
}

export function CurrencyInput({
  value,
  onChange,
  currency = 'BRL',
  disabled,
  className,
  placeholder,
}: CurrencyInputProps) {
  const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.BRL
  const [display, setDisplay] = useState(() =>
    value ? new Intl.NumberFormat(cfg.locale, { minimumFractionDigits: 2 }).format(value) : '',
  )

  useEffect(() => {
    if (value !== undefined && value !== null) {
      setDisplay(
        value ? new Intl.NumberFormat(cfg.locale, { minimumFractionDigits: 2 }).format(value) : '',
      )
    }
  }, [value, cfg.locale])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.,-]/g, '')
    const normalized = raw.replace(/\./g, '').replace(',', '.')
    const num = parseFloat(normalized) || 0
    onChange(num)
    setDisplay(
      raw ? new Intl.NumberFormat(cfg.locale, { minimumFractionDigits: 2 }).format(num) : '',
    )
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground pointer-events-none">
        {cfg.symbol}
      </span>
      <Input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder ?? '0,00'}
        className={cn('pl-10 text-right', className)}
      />
    </div>
  )
}

export function CurrencyWidget({
  value,
  currency = 'BRL',
  className,
}: {
  value: number
  currency?: string
  className?: string
}) {
  return (
    <span className={cn('font-semibold tabular-nums', className)}>
      {formatCurrencyValue(value, currency)}
    </span>
  )
}

export function GlobalAutoFormatter({ children }: { children: ReactNode }) {
  const handleInput = useCallback((e: Event) => {
    const target = e.target as HTMLElement
    if (!target?.dataset) return
    const fmt = target.dataset.autoFormat
    if (!fmt) return
    const input = target as HTMLInputElement
    if (fmt === 'currency') {
      const currency = input.dataset.currency || 'BRL'
      const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.BRL
      const raw = input.value.replace(/[^\d.,-]/g, '')
      const num = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0
      const cursorPos = input.selectionStart
      input.value = raw
        ? new Intl.NumberFormat(cfg.locale, { minimumFractionDigits: 2 }).format(num)
        : ''
      if (cursorPos !== null) {
        requestAnimationFrame(() => {
          try {
            input.setSelectionRange(input.value.length, input.value.length)
          } catch {
            /* intentionally ignored */
          }
        })
      }
    } else if (fmt === 'date') {
      let v = input.value.replace(/\D/g, '').slice(0, 8)
      if (v.length >= 5) v = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4)
      else if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2)
      input.value = v
    }
  }, [])

  useEffect(() => {
    document.addEventListener('input', handleInput, true)
    return () => document.removeEventListener('input', handleInput, true)
  }, [handleInput])

  return <>{children}</>
}
