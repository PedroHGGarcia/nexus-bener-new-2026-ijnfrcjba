import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Plus, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MACHINE_EDIT_DENIED_TOOLTIP } from '@/hooks/use-machine-permissions'

/**
 * "+" quick-create button used inside the machine cascade selectors.
 *
 * When the current user is NOT allowed to edit the machine hierarchy
 * (i.e. not Comercial/Admin), the button is rendered DISABLED (kept visible
 * so the layout is not broken) and wrapped in a tooltip explaining why.
 *
 * Selection dropdowns are NOT affected — they keep working for all roles.
 */
interface MachineAddButtonProps {
  label: string
  canEdit: boolean
  disabled?: boolean
  onClick: () => void
  /** visual size variant to match the surrounding button */
  size?: 'lg' | 'sm'
  className?: string
  iconClassName?: string
}

export function MachineAddButton({
  label,
  canEdit,
  disabled,
  onClick,
  size = 'lg',
  className,
  iconClassName,
}: MachineAddButtonProps) {
  const isDisabled = disabled || !canEdit
  const iconCls = iconClassName ?? (size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5')
  const btn = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      title={canEdit ? label : MACHINE_EDIT_DENIED_TOOLTIP}
      disabled={isDisabled}
      onClick={canEdit ? onClick : undefined}
      className={cn(
        size === 'lg'
          ? 'h-10 w-10 shrink-0 border-dashed hover:border-primary hover:text-primary transition-colors'
          : 'h-9 w-9 shrink-0 border-dashed',
        !canEdit && 'opacity-60 cursor-not-allowed',
        className,
      )}
    >
      {canEdit ? <Plus className={iconCls} /> : <Lock className={iconCls} />}
    </Button>
  )

  if (canEdit) return btn

  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent>{MACHINE_EDIT_DENIED_TOOLTIP}</TooltipContent>
    </Tooltip>
  )
}
