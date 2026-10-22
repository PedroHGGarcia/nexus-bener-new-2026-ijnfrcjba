import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { ProjectCreator } from '@/types/projeto'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface CreatorDisplayProps {
  creator: ProjectCreator | null
  rawUser?: string | null
  showEmail?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function CreatorDisplay({
  creator,
  rawUser,
  showEmail = true,
  size = 'md',
  className,
}: CreatorDisplayProps) {
  const fallbackName = rawUser && !UUID_REGEX.test(rawUser) ? rawUser : null
  const name = creator?.name ?? fallbackName

  if (!name) {
    return (
      <span className="text-sm text-muted-foreground italic" aria-label="Criador não informado">
        Não informado
      </span>
    )
  }

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const avatarSize = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8'

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      aria-label={`Criado por ${name}`}
      role="group"
    >
      <Avatar className={cn(avatarSize, 'shrink-0')}>
        {creator?.avatar_url && <AvatarImage src={creator.avatar_url} alt={name} />}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col min-w-0">
        <span className={cn('font-medium truncate', size === 'sm' ? 'text-xs' : 'text-sm')}>
          {name}
        </span>
        {showEmail && creator?.email && (
          <span className="text-xs text-muted-foreground truncate">{creator.email}</span>
        )}
      </div>
    </div>
  )
}
