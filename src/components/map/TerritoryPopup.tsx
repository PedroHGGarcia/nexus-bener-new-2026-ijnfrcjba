import { TerritoryWithRep } from '@/types/area-atuacao'
import { X, MapPin, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TerritoryPopupProps {
  territory: TerritoryWithRep
  clients: { id: string; fantasia: string; cidade: string | null; estado: string | null }[]
  loadingClients: boolean
  onClose: () => void
  position: { x: number; y: number }
}

export function TerritoryPopup({
  territory,
  clients,
  loadingClients,
  onClose,
  position,
}: TerritoryPopupProps) {
  const popupStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${Math.min(position.x + 10, 320)}px`,
    top: `${Math.max(position.y - 80, 10)}px`,
    zIndex: 30,
  }

  return (
    <div
      style={popupStyle}
      className="bg-card border border-border rounded-lg shadow-xl p-4 w-72 animate-fade-in-up"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: territory.cor || '#3b82f6' }}
          />
          <h3 className="text-sm font-bold text-foreground">
            {territory.representante_nome || 'Sem representante'}
          </h3>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {territory.representante_sigla && (
        <p className="text-xs text-muted-foreground mb-3">Sigla: {territory.representante_sigla}</p>
      )}

      <div className="border-t border-border pt-2">
        <div className="flex items-center gap-1.5 mb-2">
          <Building2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Clientes na Área
          </span>
        </div>

        {loadingClients ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Nenhum cliente vinculado a este representante.
          </p>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1">
            {clients.map((client) => (
              <div
                key={client.id}
                className="flex items-center gap-1.5 text-xs text-foreground py-0.5"
              >
                <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">{client.fantasia}</span>
                {client.cidade && (
                  <span className="text-muted-foreground">
                    — {client.cidade}/{client.estado || ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {!loadingClients && clients.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2 font-semibold">
            Total: {clients.length} cliente(s)
          </p>
        )}
      </div>
    </div>
  )
}
