import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface TurnstileProps {
  siteKey: string
  onToken: (token: string) => void
  className?: string
}
export function Turnstile({ siteKey, onToken, className }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const cbName = useRef(`turnstile_cb_${Date.now()}`)

  useEffect(() => {
    ;(window as unknown as Record<string, unknown>)[cbName.current] = () => {}
    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')
    if (existing) {
      setLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => setLoaded(true)
    document.head.appendChild(script)
    return () => {
      delete (window as unknown as Record<string, unknown>)[cbName.current]
    }
  }, [])

  useEffect(() => {
    if (!loaded || !containerRef.current) return
    const w = window as unknown as Record<string, unknown>
    const render = w['turnstile'] as
      | { render: (el: HTMLElement, opts: Record<string, unknown>) => string }
      | undefined
    if (!render) return
    const id = render.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => onToken(token),
      'expired-callback': () => onToken(''),
      'error-callback': () => onToken(''),
    })
    return () => {
      const r = w['turnstile'] as { remove?: (id: string) => void } | undefined
      r?.remove?.(id)
    }
  }, [loaded, siteKey, onToken])

  return <div ref={containerRef} className={className} />
}

export interface ReCaptchaHandle {
  reset: () => void
}

interface ReCaptchaProps {
  siteKey: string
  action?: string
  onToken: (token: string) => void
  onError?: (error: string) => void
  className?: string
}

const RECAPTCHA_LOAD_TIMEOUT_MS = 10000
const RECAPTCHA_ERROR_MESSAGE =
  'Não foi possível concluir a verificação de segurança. Verifique sua conexão e tente novamente.'
const RECAPTCHA_LOAD_ERROR_MESSAGE =
  'Não foi possível carregar a verificação de segurança. Verifique sua conexão e tente novamente.'

let recaptchaReadyPromise: Promise<void> | null = null

function loadRecaptchaApi(): Promise<void> {
  if (recaptchaReadyPromise) return recaptchaReadyPromise

  recaptchaReadyPromise = new Promise<void>((resolve) => {
    const w = window as unknown as Record<string, unknown>

    const existingGrecaptcha = w['grecaptcha'] as { render?: unknown } | undefined
    if (existingGrecaptcha && typeof existingGrecaptcha.render === 'function') {
      resolve()
      return
    }

    const callbackName = `__grecaptcha_onload_${Date.now()}`
    w[callbackName] = () => {
      delete w[callbackName]
      resolve()
    }

    const existingScript = document.querySelector('script[src*="google.com/recaptcha/api.js"]')
    if (existingScript) {
      const checkReady = () => {
        const g = w['grecaptcha'] as { render?: unknown } | undefined
        if (g && typeof g.render === 'function') {
          delete w[callbackName]
          resolve()
        } else {
          setTimeout(checkReady, 100)
        }
      }
      checkReady()
      return
    }

    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=explicit&onload=${callbackName}`
    script.async = true
    script.defer = true
    script.onerror = () => {
      delete w[callbackName]
      recaptchaReadyPromise = null
      resolve()
    }
    document.head.appendChild(script)
  })

  return recaptchaReadyPromise
}

function resetRecaptchaLoader(): void {
  recaptchaReadyPromise = null
}

function isGrecaptchaReady(): boolean {
  const w = window as unknown as Record<string, unknown>
  const g = w['grecaptcha'] as { render?: unknown } | undefined
  return !!(g && typeof g.render === 'function')
}

export const ReCaptcha = forwardRef<ReCaptchaHandle, ReCaptchaProps>(
  ({ siteKey, action = 'login', onToken, onError, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const widgetIdRef = useRef<number | null>(null)
    const [ready, setReady] = useState(false)
    const [loadError, setLoadError] = useState(false)
    const [loadAttempt, setLoadAttempt] = useState(0)
    const cbRef = useRef(onToken)
    cbRef.current = onToken
    const onErrorRef = useRef(onError)
    onErrorRef.current = onError

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          const w = window as unknown as Record<string, unknown>
          const grecaptcha = w['grecaptcha'] as { reset: (id?: number) => void } | undefined
          if (grecaptcha && widgetIdRef.current !== null) {
            try {
              grecaptcha.reset(widgetIdRef.current)
            } catch {
              // ignore reset errors
            }
          }
        },
      }),
      [],
    )

    useEffect(() => {
      let cancelled = false
      setLoadError(false)
      setReady(false)

      const timeoutId = setTimeout(() => {
        if (!cancelled && !isGrecaptchaReady()) {
          setLoadError(true)
        }
      }, RECAPTCHA_LOAD_TIMEOUT_MS)

      loadRecaptchaApi()
        .then(() => {
          if (cancelled) return
          clearTimeout(timeoutId)
          if (isGrecaptchaReady()) {
            setReady(true)
          } else {
            setLoadError(true)
          }
        })
        .catch(() => {
          if (cancelled) return
          clearTimeout(timeoutId)
          setLoadError(true)
        })

      return () => {
        cancelled = true
        clearTimeout(timeoutId)
      }
    }, [loadAttempt])

    const renderWidget = useCallback(() => {
      const w = window as unknown as Record<string, unknown>
      const grecaptcha = w['grecaptcha'] as
        | {
            render: (el: HTMLElement, opts: Record<string, unknown>) => number
            reset: (id?: number) => void
          }
        | undefined
      if (!grecaptcha || !containerRef.current || widgetIdRef.current !== null) return
      try {
        widgetIdRef.current = grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (token: string) => {
            cbRef.current(token)
          },
          'expired-callback': () => {
            cbRef.current('')
          },
          'error-callback': () => {
            cbRef.current('')
            try {
              grecaptcha.reset(widgetIdRef.current ?? undefined)
            } catch {
              // ignore reset errors
            }
            onErrorRef.current?.(RECAPTCHA_ERROR_MESSAGE)
          },
        })
      } catch {
        setLoadError(true)
      }
    }, [siteKey, action])

    useEffect(() => {
      if (ready) renderWidget()
    }, [ready, renderWidget])

    useEffect(() => {
      return () => {
        widgetIdRef.current = null
      }
    }, [])

    const handleRetry = () => {
      resetRecaptchaLoader()
      widgetIdRef.current = null
      setLoadAttempt((prev) => prev + 1)
    }

    if (loadError) {
      return (
        <div className={cn('flex flex-col items-center gap-3 py-2', className)}>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs text-center">{RECAPTCHA_LOAD_ERROR_MESSAGE}</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleRetry} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar novamente
          </Button>
        </div>
      )
    }

    return <div ref={containerRef} className={className} />
  },
)
ReCaptcha.displayName = 'ReCaptcha'

function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
