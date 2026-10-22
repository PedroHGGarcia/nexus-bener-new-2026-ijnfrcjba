import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

function maskToPtBR(raw: string, maxDecimals: number): string {
  let cleaned = raw.replace(/[^\d,]/g, '')
  if (!cleaned) return ''

  const firstComma = cleaned.indexOf(',')
  if (firstComma !== -1) {
    cleaned = cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, '')
  }

  const [intStr, decStr] = cleaned.split(',')

  let intFormatted = ''
  if (intStr) {
    const intNum = parseInt(intStr, 10)
    if (!isNaN(intNum)) {
      intFormatted = intNum.toLocaleString('pt-BR')
    }
  } else if (decStr !== undefined) {
    intFormatted = '0'
  }

  if (decStr !== undefined) {
    return `${intFormatted},${decStr.slice(0, maxDecimals)}`
  }

  return intFormatted
}

function unmaskFromPtBR(display: string): number {
  if (!display) return 0
  const normalized = display.replace(/\./g, '').replace(',', '.')
  return parseFloat(normalized) || 0
}

function numberToPtBR(value: number, maxDecimals: number): string {
  if (value == null || isNaN(value)) return ''
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: maxDecimals > 0 ? maxDecimals : 0,
    maximumFractionDigits: maxDecimals,
  })
}

interface FormattedNumberInputProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
  placeholder?: string
  prefix?: string
  suffix?: string
  maxDecimals?: number
}

export function FormattedNumberInput({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  prefix,
  suffix,
  maxDecimals = 2,
}: FormattedNumberInputProps) {
  const [display, setDisplay] = useState(() => numberToPtBR(value, maxDecimals))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) {
      setDisplay(numberToPtBR(value, maxDecimals))
    }
  }, [value, maxDecimals, focused])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskToPtBR(e.target.value, maxDecimals)
    setDisplay(masked)
    onChange(unmaskFromPtBR(masked))
  }

  const handleFocus = () => setFocused(true)
  const handleBlur = () => {
    setFocused(false)
    setDisplay(numberToPtBR(value, maxDecimals))
  }

  const inputEl = (
    <Input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder={placeholder ?? (maxDecimals > 0 ? '0,00' : '0')}
      className={cn(prefix && 'pl-10', suffix && 'pr-8', 'text-right', className)}
    />
  )

  if (!prefix && !suffix) {
    return inputEl
  }

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground pointer-events-none z-10">
          {prefix}
        </span>
      )}
      {inputEl}
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground pointer-events-none z-10">
          {suffix}
        </span>
      )}
    </div>
  )
}
