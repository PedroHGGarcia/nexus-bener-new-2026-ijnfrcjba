import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/use-auth'
import { ReCaptcha, ReCaptchaHandle } from '@/components/shared/captcha'
import { verifyRecaptchaToken, RECAPTCHA_SITE_KEY } from '@/services/recaptcha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import benerLogo from '@/assets/systemlogo-large-092c5.png'
import nexusLogo from '@/assets/geminigeneratedimage2ivr482ivr482ivr-photoroom-418c7.png'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
})

type LoginValues = z.infer<typeof loginSchema>

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaError, setCaptchaError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const captchaRef = useRef<ReCaptchaHandle>(null)
  const { signIn, loading } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (values: LoginValues) => {
    setAuthError('')
    setCaptchaError('')

    if (!captchaToken) {
      setCaptchaError('Complete a verificação de segurança para continuar.')
      return
    }

    setSubmitting(true)

    const res = await verifyRecaptchaToken(captchaToken, 'login')
    if (!res.ok) {
      setCaptchaError(
        ('error' in res && res.error) || 'Falha na verificação de segurança. Tente novamente.',
      )
      setCaptchaToken('')
      captchaRef.current?.reset()
      setSubmitting(false)
      return
    }
    if (!res.data.verified) {
      setCaptchaError('Falha na verificação de segurança. Tente novamente.')
      setCaptchaToken('')
      captchaRef.current?.reset()
      setSubmitting(false)
      return
    }

    const { error } = await signIn(values.email, values.password)
    if (error) {
      setAuthError('Credenciais inválidas')
      setCaptchaToken('')
      captchaRef.current?.reset()
    } else {
      navigate('/dashboard')
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/50 to-accent/20 p-4">
      <Card className="w-full max-w-md shadow-elevation border-border">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center items-center py-2">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 px-6 py-4 bg-white/95 rounded-xl border border-border/40 shadow-xs">
              <img
                src={nexusLogo}
                alt="NEXUS"
                className="h-20 sm:h-24 md:h-28 w-auto max-w-[300px] sm:max-w-[360px] md:max-w-[400px] object-contain shrink-0 mix-blend-multiply"
              />
              <div
                className="hidden sm:block h-16 w-px bg-border/80"
                role="separator"
                aria-orientation="vertical"
              />
              <img
                src={benerLogo}
                alt="Bener Máquinas"
                className="h-8 sm:h-9 w-auto max-w-[130px] sm:max-w-[140px] object-contain shrink-0"
              />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Entrar no Nexus</CardTitle>
          <CardDescription>Nexus — Sistema de Gestão Comercial da Bener Máquinas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {authError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">E-mail corporativo</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.nome@bener.com.br"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary font-medium hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {captchaError && <p className="text-xs text-destructive">{captchaError}</p>}

            <div className="flex justify-center">
              <ReCaptcha
                ref={captchaRef}
                siteKey={RECAPTCHA_SITE_KEY}
                onToken={(token) => {
                  setCaptchaToken(token)
                  if (token) setCaptchaError('')
                }}
                onError={(error) => {
                  setCaptchaToken('')
                  setCaptchaError(error)
                }}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 font-semibold gap-2"
              disabled={loading || submitting}
            >
              {loading || submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Entrar no Sistema <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-center text-xs text-muted-foreground border-t border-border pt-4">
          <div className="flex items-center gap-1 justify-center text-primary font-medium">
            <ShieldCheck className="w-4 h-4" /> Conexão Criptografada Bener Security
          </div>
          <p>© {new Date().getFullYear()} Bener Máquinas S.A. Todos os direitos reservados.</p>
        </CardFooter>
      </Card>
    </div>
  )
}
