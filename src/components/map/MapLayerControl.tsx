import { MapLayerConfig } from '@/types/area-atuacao'
import { Layers, Map, Users, Hexagon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MapLayerControlProps {
  config: MapLayerConfig
  onChange: (config: MapLayerConfig) => void
}

export function MapLayerControl({ config, onChange }: MapLayerControlProps) {
  const layers = [
    { key: 'baseMap' as const, label: 'Mapa Base', icon: Map },
    { key: 'territories' as const, label: 'Territórios', icon: Hexagon },
    { key: 'clients' as const, label: 'Clientes', icon: Users },
  ]

  return (
    <div className="absolute top-3 right-3 z-20 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2 space-y-1 min-w-[160px]">
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Layers className="w-3.5 h-3.5" />
        Camadas
      </div>
      {layers.map(({ key, label, icon: Icon }) => {
        const active = config[key]
        return (
          <button
            key={key}
            onClick={() => onChange({ ...config, [key]: !active })}
            className={cn(
              'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs font-medium transition-colors duration-150',
              active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">{label}</span>
            <span
              className={cn(
                'w-3 h-3 rounded-full border-2 transition-colors duration-150',
                active ? 'bg-primary border-primary' : 'border-muted-foreground/40',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
