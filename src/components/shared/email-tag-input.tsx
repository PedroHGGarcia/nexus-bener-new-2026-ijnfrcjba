import { useState, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  emails: string[]
  onChange: (emails: string[]) => void
  placeholder?: string
  className?: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function EmailTagInput({
  emails,
  onChange,
  placeholder = 'Digite um e-mail e pressione Enter',
  className,
}: Props) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const addEmailsFromText = (rawText: string) => {
    if (!rawText || !rawText.trim()) return
    const candidates = rawText
      .split(/[,;\s\n\r]+/)
      .map((item) => item.trim())
      .filter(Boolean)

    if (candidates.length === 0) return

    const validNewEmails: string[] = []
    let hasInvalid = false

    for (const cand of candidates) {
      if (EMAIL_REGEX.test(cand)) {
        if (!emails.includes(cand) && !validNewEmails.includes(cand)) {
          validNewEmails.push(cand)
        }
      } else {
        hasInvalid = true
      }
    }

    if (validNewEmails.length > 0) {
      onChange([...emails, ...validNewEmails])
    }

    if (hasInvalid) {
      setError(true)
    } else {
      setError(false)
      setInput('')
    }
  }

  const addEmail = () => {
    addEmailsFromText(input)
  }

  const removeEmail = (email: string) => onChange(emails.filter((e) => e !== email))

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === ' ') {
      e.preventDefault()
      addEmail()
    } else if (e.key === 'Backspace' && !input && emails.length > 0) {
      removeEmail(emails[emails.length - 1])
    } else if (error) {
      setError(false)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')
    if (pasted && (pasted.includes(',') || pasted.includes(';') || /\s/.test(pasted))) {
      e.preventDefault()
      addEmailsFromText(pasted)
    }
  }

  return (
    <div className="space-y-1">
      <div
        className={cn(
          'flex flex-wrap gap-1.5 items-center min-h-10 rounded-md border border-input bg-background px-2 py-1.5',
          error && 'border-destructive',
          className,
        )}
      >
        <Mail className="w-3.5 h-3.5 text-muted-foreground mr-1" />
        {emails.map((email) => (
          <Badge key={email} variant="secondary" className="gap-1 pr-1">
            {email}
            <button
              type="button"
              onClick={() => removeEmail(email)}
              className="hover:bg-accent rounded-sm p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <input
          value={input}
          onChange={(e) => {
            const val = e.target.value
            // If comma or semicolon was typed/entered inside the value
            if (val.includes(',') || val.includes(';') || val.includes('\n')) {
              addEmailsFromText(val)
            } else {
              setInput(val)
              setError(false)
            }
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={addEmail}
          placeholder={emails.length === 0 ? placeholder : ''}
          className="flex-1 min-w-32 bg-transparent outline-none text-sm py-0.5"
        />
      </div>
      {error && <p className="text-xs text-destructive">E-mail inválido.</p>}
    </div>
  )
}
