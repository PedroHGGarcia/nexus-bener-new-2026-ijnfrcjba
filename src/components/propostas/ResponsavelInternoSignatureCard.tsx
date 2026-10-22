import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { PenTool, Eraser, Check, CheckCircle2, Trash2, UserCheck, RotateCcw } from 'lucide-react'

interface Props {
  value: string | null
  onChange: (value: string | null) => void
  profileSignature?: string | null
  userName?: string | null
  disabled?: boolean
  title?: string
  roleLabel?: string
}

/**
 * Área de assinatura do responsável interno — comercial.
 * Permite:
 * 1. Desenhar a assinatura manualmente (mouse / touch) em um canvas confortável.
 * 2. Usar a assinatura cadastrada no perfil (se houver).
 * 3. Limpar / remover a assinatura.
 * 4. Não é obrigatória: se não assinar, a proposta pode ser gerada normalmente.
 */
export function ResponsavelInternoSignatureCard({
  value,
  onChange,
  profileSignature,
  userName,
  disabled = false,
  title = 'Assinatura do Responsável Interno — Comercial',
  roleLabel = 'Responsável',
}: Props) {
  const [mode, setMode] = useState<'profile' | 'draw'>(
    value && profileSignature && value === profileSignature ? 'profile' : 'draw',
  )
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const [hasCanvasStrokes, setHasCanvasStrokes] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState<boolean>(() => !!value)

  useEffect(() => {
    setIsConfirmed(!!value)
  }, [value])

  // Configure canvas 2D context
  const setupCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  useEffect(() => {
    setupCanvas()
  }, [mode])

  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    // Account for CSS scale
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // safe fallback
    }
    isDrawing.current = true
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getCanvasPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !isDrawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getCanvasPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    if (!hasCanvasStrokes) {
      setHasCanvasStrokes(true)
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return
    isDrawing.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // safe fallback
    }
  }

  const handlePointerCancel = () => {
    isDrawing.current = false
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    setHasCanvasStrokes(false)
    setIsConfirmed(false)
    onChange(null)
  }

  const handleConfirmSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const dataUrl = canvas.toDataURL('image/png')
      onChange(dataUrl)
      setIsConfirmed(true)
      toast({
        title: 'Assinatura confirmada!',
        description: 'Sua assinatura foi vinculada à proposta com sucesso.',
      })
    } catch (err) {
      console.warn('[ResponsavelInternoSignatureCard] Erro ao extrair dataUrl do canvas:', err)
    }
  }

  const handleRedoSignature = () => {
    setIsConfirmed(false)
    setHasCanvasStrokes(false)
    onChange(null)
    setTimeout(() => {
      setupCanvas()
    }, 50)
  }

  const handleSelectProfileSig = () => {
    if (profileSignature) {
      onChange(profileSignature)
      setIsConfirmed(true)
      setMode('profile')
      toast({
        title: 'Assinatura confirmada!',
        description: 'Sua assinatura foi vinculada à proposta com sucesso.',
      })
    }
  }

  const isProfileActive = !!value && !!profileSignature && value.trim() === profileSignature.trim()
  const isCustomDrawn = !!value && (!profileSignature || value.trim() !== profileSignature.trim())

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div className="flex items-center gap-2 text-base font-semibold text-primary">
          <PenTool className="w-5 h-5 text-primary" />
          <span>{title}</span>
          <span className="text-xs font-normal text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            Opcional
          </span>
        </div>
        {userName && (
          <span className="text-xs text-muted-foreground">
            {roleLabel}: <strong className="text-foreground">{userName}</strong>
          </span>
        )}
      </div>

      <Card className="border border-slate-200 dark:border-slate-800">
        <CardContent className="p-5 space-y-4">
          {/* Mode Switcher / Helpful hints */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={mode === 'draw' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('draw')}
                disabled={disabled}
                className={
                  mode === 'draw'
                    ? 'bg-[#0b3c26] text-white hover:bg-[#082f1e] font-semibold gap-1.5'
                    : 'gap-1.5'
                }
              >
                <PenTool className="w-4 h-4" />
                Desenhar Assinatura
              </Button>

              {profileSignature && (
                <Button
                  type="button"
                  variant={mode === 'profile' ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleSelectProfileSig}
                  disabled={disabled}
                  className={
                    mode === 'profile'
                      ? 'bg-[#0b3c26] text-white hover:bg-[#082f1e] font-semibold gap-1.5'
                      : 'gap-1.5'
                  }
                >
                  <UserCheck className="w-4 h-4" />
                  Usar Assinatura do Perfil
                </Button>
              )}
            </div>

            {value && !(mode === 'draw' && isConfirmed) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearCanvas()
                  onChange(null)
                }}
                disabled={disabled}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover assinatura
              </Button>
            )}
          </div>

          {/* Mode: DRAW */}
          {mode === 'draw' && (
            <div className="space-y-2">
              {isConfirmed && value ? (
                /* Bloco verde de confirmação com prévia da assinatura, selo e botões */
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="border border-emerald-200 rounded-md bg-white p-2 h-20 min-w-[160px] max-w-[220px] flex items-center justify-center shadow-sm">
                      <img
                        src={value}
                        alt="Assinatura vinculada"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Assinatura vinculada
                        </Badge>
                      </div>
                      <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                        Sua assinatura desenhada está vinculada à proposta com sucesso.
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        Ela será impressa no documento comercial na seção de assinaturas.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRedoSignature}
                      disabled={disabled}
                      className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 dark:border-emerald-700 gap-1.5 text-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Refazer assinatura
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        clearCanvas()
                      }}
                      disabled={disabled}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 gap-1 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover
                    </Button>
                  </div>
                </div>
              ) : (
                /* Quadro de desenho ativo */
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Desenhe sua assinatura no quadro abaixo (use o mouse ou o dedo no
                      celular/tablet):
                    </Label>
                  </div>

                  <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg bg-white overflow-hidden shadow-inner">
                    <canvas
                      ref={canvasRef}
                      width={560}
                      height={160}
                      className={`w-full h-[150px] sm:h-[160px] touch-none select-none ${
                        disabled
                          ? 'bg-muted/40 cursor-not-allowed opacity-60'
                          : 'cursor-crosshair bg-white'
                      }`}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerCancel}
                      onPointerLeave={handlePointerUp}
                    />

                    {!hasCanvasStrokes && (
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs sm:text-sm select-none">
                        <PenTool className="w-6 h-6 mb-1 opacity-50" />
                        <span>Clique e arraste para assinar aqui</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearCanvas}
                        disabled={disabled || !hasCanvasStrokes}
                        className="gap-1.5 text-slate-700 text-xs"
                      >
                        <Eraser className="w-3.5 h-3.5" />
                        Limpar desenho
                      </Button>

                      {hasCanvasStrokes && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleConfirmSignature}
                          disabled={disabled}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-semibold"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Confirmar assinatura
                        </Button>
                      )}
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Se preferir não assinar agora, a proposta pode ser gerada sem assinatura.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mode: PROFILE */}
          {mode === 'profile' && profileSignature && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Assinatura cadastrada no seu perfil:
                </Label>
                {isProfileActive && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Ativa para esta proposta
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border rounded-lg bg-slate-50/70 dark:bg-slate-900/50">
                <div className="flex items-center gap-4">
                  <div className="border rounded-md p-2 bg-white h-[70px] min-w-[180px] max-w-[240px] flex items-center justify-center shadow-sm">
                    <img
                      src={profileSignature}
                      alt="Assinatura do perfil"
                      className="max-h-[55px] object-contain"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Assinatura digital do perfil
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Carregada automaticamente do cadastro do usuário.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isProfileActive && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSelectProfileSig}
                      disabled={disabled}
                      className="bg-[#0b3c26] text-white hover:bg-[#082f1e] gap-1 text-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Usar esta assinatura
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMode('draw')
                      clearCanvas()
                    }}
                    disabled={disabled}
                    className="gap-1 text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Desenhar outra
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Fallback if user toggled to profile mode but has no profile signature */}
          {mode === 'profile' && !profileSignature && (
            <div className="p-4 rounded-md border border-dashed text-center text-xs text-muted-foreground space-y-2">
              <p>Nenhuma assinatura digital encontrada no seu perfil de usuário.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMode('draw')}
                className="gap-1.5"
              >
                <PenTool className="w-4 h-4" />
                Desenhar Assinatura Agora
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
