import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '@/hooks/use-auth'
import { ReCaptcha, ReCaptchaHandle } from '@/components/shared/captcha'
import { verifyRecaptchaToken, RECAPTCHA_SITE_KEY } from '@/services/recaptcha'
import {
  verifyResetToken,
  resetPasswordWithToken,
  requestPasswordReset,
} from '@/services/password-reset'
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
import {
  ArrowLeft,
  Mail,
  Lock,
  KeyRound,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  AlertTriangle,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import benerLogo from '@/assets/systemlogo-large-092c5.png'

const emailSchema = z.string().email('E-mail inválido')

// Strong password schema: 8+ chars, 1 uppercase, 1 special character
const strongPasswordSchema = z
  .string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres')
  .regex(/[A-Z]/, 'A senha deve conter pelo menos 1 letra maiúscula')
  .regex(
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/,
    'A senha deve conter pelo menos 1 caractere especial (!@#$%^&*...)',
  )

export default function ForgotPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const tokenParam = searchParams.get('token') || ''

  // Mode 1: Request reset email
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaError, setCaptchaError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const captchaRef = useRef<ReCaptchaHandle>(null)
  const { signIn } = useAuth()

  // Mode 2: Reset form when token is present
  const [token, setToken] = useState<string>(tokenParam)
  const [tokenChecking, setTokenChecking] = useState<boolean>(!!tokenParam)
  const [tokenValid, setTokenValid] = useState<boolean>(false)
  const [tokenEmail, setTokenEmail] = useState<string>('')
  const [tokenError, setTokenError] = useState<string>('')

  // New password inputs
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Verify token on mount if present
  useEffect(() => {
    if (!tokenParam) {
      setTokenChecking(false)
      return
    }

    let isMounted = true
    setToken(tokenParam)
    setTokenChecking(true)
    setTokenError('')

    verifyResetToken(tokenParam).then((res) => {
      if (!isMounted) return
      setTokenChecking(false)
      if (res.valid) {
        setTokenValid(true)
        setTokenEmail(res.email || '')
      } else {
        setTokenValid(false)
        setTokenError(
          res.error || 'Link de recuperação inválido ou expirado. Os links expiram em 15 minutos.',
        )
      }
    })

    return () => {
      isMounted = false
    }
  }, [tokenParam])

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  // Handle Send Reset Link
  const handleSend = async () => {
    setError('')
    setCaptchaError('')

    if (!captchaToken) {
      setCaptchaError('Complete a verificação de segurança para continuar.')
      return
    }

    const result = emailSchema.safeParse(email)
    if (!result.success) {
      const err = (result as any).error
      setError(err.issues?.[0]?.message || err.errors?.[0]?.message || 'Email inválido')
      return
    }

    setSubmitting(true)

    const resCaptcha = await verifyRecaptchaToken(captchaToken, 'password_reset')
    if (!resCaptcha.ok) {
      setCaptchaError(
        ('error' in resCaptcha && resCaptcha.error) ||
          'Falha na verificação de segurança. Tente novamente.',
      )
      setCaptchaToken('')
      captchaRef.current?.reset()
      setSubmitting(false)
      return
    }
    if (!resCaptcha.data.verified) {
      setCaptchaError('Falha na verificação de segurança. Tente novamente.')
      setCaptchaToken('')
      captchaRef.current?.reset()
      setSubmitting(false)
      return
    }

    const resetRes = await requestPasswordReset(email)
    if (!resetRes.ok) {
      const errMsg =
        'error' in resetRes ? resetRes.error : 'Não foi possível enviar o e-mail. Tente novamente.'
      setError(errMsg || 'Não foi possível enviar o e-mail. Tente novamente.')
      setCaptchaToken('')
      captchaRef.current?.reset()
      setSubmitting(false)
      return
    }

    setSent(true)
    setCooldown(60)
    setCaptchaToken('')
    captchaRef.current?.reset()
    setSubmitting(false)
  }

  // Handle Password Reset Form Submission
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate strong password
    const validation = strongPasswordSchema.safeParse(newPassword)
    if (!validation.success) {
      const err = (validation as any).error
      setError(err.issues?.[0]?.message || err.errors?.[0]?.message || 'Senha fraca')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação de senha não confere.')
      return
    }

    setResetting(true)
    const result = await resetPasswordWithToken(token, newPassword)

    if (!result.ok) {
      const errMsg = 'error' in result ? result.error : 'Erro ao redefinir a senha.'
      setError(errMsg || 'Erro ao redefinir a senha.')
      setResetting(false)
      return
    }

    setResetSuccess(true)
    setResetting(false)
  }

  // Password requirements calculation
  const hasMinLength = newPassword.length >= 8
  const hasUppercase = /[A-Z]/.test(newPassword)
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(newPassword)
  const isPasswordStrong = hasMinLength && hasUppercase && hasSpecial

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/50 to-accent/20 p-4">
      <Card className="w-full max-w-md shadow-elevation border-border">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center items-center py-2">
            <img
              src={benerLogo}
              alt="Bener Máquinas - Máquinas que Transformam"
              className="h-12 w-auto max-w-[240px] sm:max-w-[280px] object-contain drop-shadow-sm"
            />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            {token ? 'Redefinir Senha' : 'Recuperar Senha'}
          </CardTitle>
          <CardDescription className="text-xs">
            {token
              ? 'Defina sua nova senha de acesso ao Bener Nexus'
              : 'Informe seu e-mail cadastrado para receber o link de recuperação (válido por 15 minutos)'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* ==================================================== */}
          {/* FLOW A: TOKEN IS PRESENT IN URL (/redefinir-senha?token=...) */}
          {/* ==================================================== */}
          {token ? (
            tokenChecking ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-8 h-8 border-4 border-[#0b3c26] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-semibold text-muted-foreground">
                  Verificando validade do link de recuperação...
                </p>
              </div>
            ) : !tokenValid ? (
              <div className="space-y-4 py-2 text-center">
                <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto text-destructive">
                  <XCircle className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">Link Inválido ou Expirado</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {tokenError ||
                      'Por motivos de segurança, o link de recuperação expira em 15 minutos ou só pode ser usado uma vez.'}
                  </p>
                </div>
                <div className="pt-2">
                  <Button
                    onClick={() => {
                      setToken('')
                      navigate('/redefinir-senha', { replace: true })
                    }}
                    className="w-full bg-[#0b3c26] hover:bg-[#082e1d] text-white"
                  >
                    Solicitar Novo Link
                  </Button>
                </div>
              </div>
            ) : resetSuccess ? (
              <div className="space-y-4 py-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-slate-900">Senha Alterada com Sucesso!</h3>
                  <p className="text-xs text-muted-foreground">
                    Sua nova senha foi gravada com segurança. Você já pode acessar o sistema com as
                    novas credenciais.
                  </p>
                </div>
                <div className="pt-2">
                  <Button
                    onClick={() => navigate('/login')}
                    className="w-full bg-[#0b3c26] hover:bg-[#082e1d] text-white font-semibold"
                  >
                    Fazer Login Agora
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                  </Alert>
                )}

                {tokenEmail && (
                  <div className="p-3 rounded-lg bg-slate-50 border text-xs text-slate-700 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#0b3c26]" />
                    <span>
                      Redefinindo senha para: <strong>{tokenEmail}</strong>
                    </span>
                  </div>
                )}

                {/* Expiration reminder */}
                <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>Este link é válido por 15 minutos a partir do envio.</span>
                </div>

                {/* New Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs font-semibold">
                    Nova Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Digite sua nova senha"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="pr-10 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs font-semibold">
                    Confirmar Nova Senha
                  </Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="text-sm"
                  />
                </div>

                {/* Password Strength Checklist (Regras de Senha Forte) */}
                <div className="bg-slate-50 border rounded-lg p-3 space-y-1.5 text-xs">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#0b3c26]" /> Requisitos de Senha Forte:
                  </span>
                  <ul className="space-y-1 text-[11px] mt-1 pl-1">
                    <li
                      className={`flex items-center gap-1.5 ${
                        hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'
                      }`}
                    >
                      {hasMinLength ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                      )}
                      Mínimo de 8 caracteres
                    </li>
                    <li
                      className={`flex items-center gap-1.5 ${
                        hasUppercase ? 'text-emerald-700 font-medium' : 'text-slate-500'
                      }`}
                    >
                      {hasUppercase ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                      )}
                      Pelo menos 1 letra maiúscula (A-Z)
                    </li>
                    <li
                      className={`flex items-center gap-1.5 ${
                        hasSpecial ? 'text-emerald-700 font-medium' : 'text-slate-500'
                      }`}
                    >
                      {hasSpecial ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                      )}
                      Pelo menos 1 caractere especial (!@#$%^&*...)
                    </li>
                  </ul>
                </div>

                <Button
                  type="submit"
                  disabled={resetting || !isPasswordStrong}
                  className="w-full bg-[#0b3c26] hover:bg-[#082e1d] text-white font-semibold py-2.5 gap-2"
                >
                  {resetting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Gravando nova senha...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" /> Salvar Nova Senha
                    </>
                  )}
                </Button>
              </form>
            )
          ) : /* ==================================================== */
          /* FLOW B: REQUEST RECOVERY EMAIL */
          /* ==================================================== */
          sent ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#0b3c26] flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Verifique seu e-mail</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Se o endereço <strong className="text-slate-900">{email}</strong> estiver
                  cadastrado, enviamos um link amigável de recuperação.{' '}
                  <span className="text-amber-700 font-semibold block mt-1">
                    O link tem validade de 15 minutos.
                  </span>
                </p>
              </div>
              {captchaError && <p className="text-xs text-destructive">{captchaError}</p>}
              {cooldown > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Poderá solicitar um novo link em {cooldown}s
                </p>
              ) : (
                <>
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
                    onClick={handleSend}
                    disabled={submitting}
                    variant="outline"
                    className="gap-2 text-xs border-[#0b3c26]/30 text-[#0b3c26]"
                  >
                    {submitting ? 'Enviando...' : 'Reenviar link de recuperação'}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="space-y-4"
            >
              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">
                  E-mail cadastrado
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.nome@bener.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-sm"
                />
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
                disabled={submitting}
                className="w-full bg-[#0b3c26] hover:bg-[#082e1d] text-white font-semibold py-2.5"
              >
                {submitting ? 'Enviando link...' : 'Enviar link de recuperação'}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center border-t border-border pt-4">
          <Link
            to="/login"
            className="text-xs text-[#0b3c26] font-semibold hover:underline flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o Login
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
