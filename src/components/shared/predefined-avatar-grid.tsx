import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { PREDEFINED_AVATARS } from '@/lib/predefined-avatars'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { AnimatedAvatarSvg } from '@/components/shared/animated-avatars'

export function PredefinedAvatarGrid() {
  const { user, updateProfile } = useAuth()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const currentAvatarUrl = user?.avatarUrl ?? ''

  const handleSelect = async (avatarUrl: string, avatarId: string) => {
    if (avatarUrl === currentAvatarUrl) return
    setSavingId(avatarId)
    const { error } = await updateProfile({ avatarUrl })
    if (error) {
      toast.error(`Erro: ${error}`)
    } else {
      setSavedId(avatarId)
      toast.success('Avatar atualizado!')
      setTimeout(() => setSavedId(null), 2000)
    }
    setSavingId(null)
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-6 gap-1 sm:gap-1.5 max-w-[260px]">
        {PREDEFINED_AVATARS.map((avatar) => {
          const isActive = avatar.url === currentAvatarUrl
          const isSaving = savingId === avatar.id
          const justSaved = savedId === avatar.id
          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => handleSelect(avatar.url, avatar.id)}
              disabled={isSaving}
              className={cn(
                'relative rounded-full overflow-hidden transition-all duration-200',
                'w-8 h-8 sm:w-9 sm:h-9',
                'hover:scale-110 hover:z-10',
                isActive
                  ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-105'
                  : 'opacity-70 hover:opacity-100',
                isSaving && 'opacity-60',
              )}
              aria-label={avatar.label}
              aria-pressed={isActive}
            >
              <AnimatedAvatarSvg id={avatar.id} className="w-full h-full" />
              {isActive && (
                <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white drop-shadow-md" />
                </div>
              )}
              {isSaving && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-3 h-3 text-white animate-spin" />
                </div>
              )}
              {justSaved && !isActive && (
                <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center animate-fade-in">
                  <CheckCircle2 className="w-3 h-3 text-white drop-shadow-md" />
                </div>
              )}
            </button>
          )
        })}
      </div>
      {savedId && (
        <p className="text-xs text-green-600 font-medium animate-fade-in">
          Avatar atualizado com sucesso!
        </p>
      )}
    </div>
  )
}
