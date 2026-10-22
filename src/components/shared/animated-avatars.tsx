import type { CSSProperties } from 'react'
import { AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import './animated-avatars.css'

interface CartoonAvatarConfig {
  id: string
  bg: string
  face: string
  accent: string
  cheek: string
  ears?: 'cat' | 'bunny' | 'bear' | 'devil' | 'panda'
  mouth?: 'smile' | 'open' | 'tongue' | 'neutral' | 'whistle'
  accessory?: 'hat' | 'bow' | 'crown' | 'glasses' | 'flower'
  delay: number
}

const AVATAR_CONFIGS: CartoonAvatarConfig[] = [
  {
    id: 'av1',
    bg: '#FFE0B2',
    face: '#FFCC80',
    accent: '#5D4037',
    cheek: '#FF8A65',
    ears: 'cat',
    mouth: 'smile',
    delay: 0,
  },
  {
    id: 'av2',
    bg: '#E1BEE7',
    face: '#CE93D8',
    accent: '#4A148C',
    cheek: '#F06292',
    ears: 'bunny',
    mouth: 'open',
    accessory: 'bow',
    delay: 0.3,
  },
  {
    id: 'av3',
    bg: '#B2DFDB',
    face: '#80CBC4',
    accent: '#004D40',
    cheek: '#FF8A65',
    ears: 'bear',
    mouth: 'tongue',
    delay: 0.6,
  },
  {
    id: 'av4',
    bg: '#C5CAE9',
    face: '#9FA8DA',
    accent: '#1A237E',
    cheek: '#F48FB1',
    ears: 'panda',
    mouth: 'neutral',
    accessory: 'glasses',
    delay: 0.9,
  },
  {
    id: 'av5',
    bg: '#FFCDD2',
    face: '#EF9A9A',
    accent: '#B71C1C',
    cheek: '#E91E63',
    ears: 'devil',
    mouth: 'whistle',
    delay: 1.2,
  },
  {
    id: 'av6',
    bg: '#C8E6C9',
    face: '#A5D6A7',
    accent: '#1B5E20',
    cheek: '#FF8A65',
    ears: 'cat',
    mouth: 'smile',
    accessory: 'flower',
    delay: 1.5,
  },
  {
    id: 'av7',
    bg: '#F8BBD0',
    face: '#F48FB1',
    accent: '#880E4F',
    cheek: '#E91E63',
    ears: 'bunny',
    mouth: 'open',
    delay: 0.5,
  },
  {
    id: 'av8',
    bg: '#BBDEFB',
    face: '#90CAF9',
    accent: '#0D47A1',
    cheek: '#FF8A65',
    ears: 'bear',
    mouth: 'tongue',
    accessory: 'hat',
    delay: 0.8,
  },
  {
    id: 'av9',
    bg: '#FFF9C4',
    face: '#FFF176',
    accent: '#F57F17',
    cheek: '#FF8A65',
    mouth: 'smile',
    accessory: 'crown',
    delay: 1.1,
  },
  {
    id: 'av10',
    bg: '#D1C4E9',
    face: '#B39DDB',
    accent: '#311B92',
    cheek: '#F48FB1',
    ears: 'panda',
    mouth: 'neutral',
    delay: 1.4,
  },
  {
    id: 'av11',
    bg: '#B2EBF2',
    face: '#80DEEA',
    accent: '#006064',
    cheek: '#FF8A65',
    ears: 'devil',
    mouth: 'whistle',
    accessory: 'glasses',
    delay: 0.2,
  },
  {
    id: 'av12',
    bg: '#FFCCBC',
    face: '#FFAB91',
    accent: '#BF360C',
    cheek: '#F06292',
    mouth: 'open',
    accessory: 'flower',
    delay: 0.7,
  },
]

function Ears({ type, color }: { type: string; color: string }) {
  switch (type) {
    case 'cat':
      return (
        <g className="avatar-anim-ears">
          <path d="M28 35 L22 12 L38 28 Z" fill={color} />
          <path d="M72 35 L78 12 L62 28 Z" fill={color} />
        </g>
      )
    case 'bunny':
      return (
        <g className="avatar-anim-ears">
          <ellipse cx="40" cy="16" rx="5" ry="12" fill={color} />
          <ellipse cx="60" cy="16" rx="5" ry="12" fill={color} />
        </g>
      )
    case 'bear':
      return (
        <>
          <circle cx="32" cy="26" r="7" fill={color} />
          <circle cx="68" cy="26" r="7" fill={color} />
        </>
      )
    case 'devil':
      return (
        <g className="avatar-anim-ears">
          <path d="M38 25 L32 8 L44 20 Z" fill={color} />
          <path d="M62 25 L68 8 L56 20 Z" fill={color} />
        </g>
      )
    case 'panda':
      return (
        <>
          <circle cx="32" cy="26" r="8" fill="#333" />
          <circle cx="68" cy="26" r="8" fill="#333" />
        </>
      )
    default:
      return null
  }
}

function Mouth({ type, color }: { type: string; color: string }) {
  switch (type) {
    case 'smile':
      return (
        <path
          d="M42 62 Q50 70 58 62"
          stroke={color}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      )
    case 'open':
      return <ellipse cx="50" cy="64" rx="5" ry="3.5" fill={color} />
    case 'tongue':
      return (
        <>
          <ellipse cx="50" cy="63" rx="4" ry="3" fill={color} />
          <ellipse cx="50" cy="67" rx="2.5" ry="2.5" fill="#FF6B6B" />
        </>
      )
    case 'neutral':
      return (
        <line
          x1="44"
          y1="64"
          x2="56"
          y2="64"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )
    case 'whistle':
      return <circle cx="52" cy="64" r="2.5" fill={color} />
    default:
      return null
  }
}

function Accessory({ type, color }: { type: string; color: string }) {
  switch (type) {
    case 'hat':
      return <path d="M35 22 L50 6 L65 22 Z" fill={color} />
    case 'bow':
      return (
        <g transform="translate(50 16)">
          <path d="M-7 0 L-10 -3 L-10 3 Z" fill={color} />
          <path d="M7 0 L10 -3 L10 3 Z" fill={color} />
          <circle r="2" fill={color} />
        </g>
      )
    case 'crown':
      return <path d="M35 20 L35 8 L42 14 L50 6 L58 14 L65 8 L65 20 Z" fill={color} />
    case 'glasses':
      return (
        <g>
          <circle cx="40" cy="48" r="6" fill="none" stroke={color} strokeWidth="2" />
          <circle cx="60" cy="48" r="6" fill="none" stroke={color} strokeWidth="2" />
          <line x1="46" y1="48" x2="54" y2="48" stroke={color} strokeWidth="2" />
        </g>
      )
    case 'flower':
      return (
        <g transform="translate(68 20)">
          <circle r="3" fill={color} />
          <circle cx="-3" cy="0" r="2.5" fill={color} opacity="0.7" />
          <circle cx="3" cy="0" r="2.5" fill={color} opacity="0.7" />
          <circle cx="0" cy="-3" r="2.5" fill={color} opacity="0.7" />
          <circle cx="0" cy="3" r="2.5" fill={color} opacity="0.7" />
        </g>
      )
    default:
      return null
  }
}

export function AnimatedAvatarSvg({
  id,
  className,
  style,
}: {
  id: string
  className?: string
  style?: CSSProperties
}) {
  const config = AVATAR_CONFIGS.find((c) => c.id === id)
  if (!config) return null
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('avatar-anim-container', className)}
      style={{ animationDelay: `${config.delay}s`, ...style }}
    >
      <circle cx="50" cy="50" r="48" fill={config.bg} />
      {config.ears && <Ears type={config.ears} color={config.face} />}
      <circle cx="50" cy="52" r="30" fill={config.face} />
      <g className="avatar-anim-eyes">
        <circle cx="40" cy="48" r="4.5" fill={config.accent} />
        <circle cx="60" cy="48" r="4.5" fill={config.accent} />
      </g>
      <circle cx="33" cy="56" r="3" fill={config.cheek} opacity="0.4" />
      <circle cx="67" cy="56" r="3" fill={config.cheek} opacity="0.4" />
      {config.mouth && <Mouth type={config.mouth} color={config.accent} />}
      {config.accessory && <Accessory type={config.accessory} color={config.cheek} />}
    </svg>
  )
}

export function isAnimatedAvatar(url?: string): boolean {
  return !!url?.startsWith('animated:')
}

export function getAvatarId(url?: string): string | null {
  if (!url?.startsWith('animated:')) return null
  return url.split(':')[1] ?? null
}

export function SmartAvatarImage({ src, alt }: { src?: string; alt?: string }) {
  const avatarId = getAvatarId(src)
  if (avatarId) return <AnimatedAvatarSvg id={avatarId} className="w-full h-full" />
  return <AvatarImage src={src} alt={alt} />
}
