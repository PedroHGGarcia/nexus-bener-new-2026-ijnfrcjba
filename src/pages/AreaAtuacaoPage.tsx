import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin, Maximize2, AlertTriangle } from 'lucide-react'
import { MapFullscreenOverlay } from '@/components/area-atuacao/MapFullscreenOverlay'

const GOOGLE_MAPS_EMBED_URL =
  'https://www.google.com/maps/d/embed?mid=1RU6uXumBUQegCqYMO-ds0t3RVxufZ2w'

export default function AreaAtuacaoPage() {
  const [mapFullscreen, setMapFullscreen] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Área de Atuação & Cobertura Técnica</h1>
        <p className="text-sm text-muted-foreground">
          Visualize territórios de representantes e gerencie áreas de cobertura
        </p>
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          A construção do mapa está em desenvolvimento e pode conter erros.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Mapa de Áreas de Atuação
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setMapFullscreen(true)}
              aria-label="Expandir mapa em tela cheia"
            >
              <Maximize2 className="w-4 h-4" />
              <span className="hidden sm:inline">Expandir mapa</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full overflow-hidden rounded-b-lg border-0">
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                src={GOOGLE_MAPS_EMBED_URL}
                title="Mapa de Áreas de Atuação - Bener Máquinas"
                className="absolute inset-0 w-full h-full"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <MapFullscreenOverlay
        open={mapFullscreen}
        onClose={() => setMapFullscreen(false)}
        src={GOOGLE_MAPS_EMBED_URL}
        title="Mapa de Áreas de Atuação - Bener Máquinas"
      />
    </div>
  )
}
