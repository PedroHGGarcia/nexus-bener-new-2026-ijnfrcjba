export interface ParsedPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

export interface ParsedGeometry {
  type: string
  coordinates: number[][][] | number[][][][]
}

export function parseKml(kmlText: string): ParsedGeometry[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(kmlText, 'text/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Arquivo KML inválido: não foi possível analisar o XML.')
  }

  const geometries: ParsedGeometry[] = []
  const polygons = doc.querySelectorAll('Polygon')

  polygons.forEach((polygon) => {
    const rings: number[][][] = []
    const outerBoundary = polygon.querySelector('outerBoundaryIs > LinearRing > coordinates')
    if (outerBoundary) {
      const ring = parseCoordinateString(outerBoundary.textContent || '')
      if (ring.length >= 3) rings.push(ring)
    }

    const innerBoundaries = polygon.querySelectorAll('innerBoundaryIs > LinearRing > coordinates')
    innerBoundaries.forEach((inner) => {
      const ring = parseCoordinateString(inner.textContent || '')
      if (ring.length >= 3) rings.push(ring)
    })

    if (rings.length > 0) {
      geometries.push({ type: 'Polygon', coordinates: rings })
    }
  })

  if (geometries.length === 0) {
    const lineStrings = doc.querySelectorAll('LineString > coordinates')
    if (lineStrings.length > 0) {
      const coords = parseCoordinateString(lineStrings[0].textContent || '')
      if (coords.length >= 3) {
        const closed = [...coords]
        const first = coords[0]
        const last = coords[coords.length - 1]
        if (first[0] !== last[0] || first[1] !== last[1]) {
          closed.push(first)
        }
        geometries.push({ type: 'Polygon', coordinates: [closed] })
      }
    }
  }

  if (geometries.length === 0) {
    throw new Error('Nenhuma geometria válida encontrada no arquivo KML.')
  }

  return geometries
}

function parseCoordinateString(text: string): number[][] {
  return text
    .trim()
    .split(/\s+/)
    .map((coord) => {
      const parts = coord.split(',').map(Number)
      return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
    })
    .filter((c) => !isNaN(c[0]) && !isNaN(c[1]))
}

export function validateGeometry(geom: ParsedGeometry): boolean {
  if (geom.type !== 'Polygon') return false
  if (!geom.coordinates || !Array.isArray(geom.coordinates)) return false
  if (geom.coordinates.length === 0) return false
  const outer = geom.coordinates[0]
  if (outer.length < 3) return false
  return outer.every(
    (coord) =>
      Array.isArray(coord) &&
      coord.length >= 2 &&
      !isNaN(Number(coord[0])) &&
      !isNaN(Number(coord[1])),
  )
}

export function toGeoJson(geom: ParsedGeometry): GeoJSON.Geometry {
  return {
    type: 'Polygon',
    coordinates: geom.coordinates as number[][][],
  } as GeoJSON.Geometry
}

const DEFAULT_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1',
]

export function getDefaultColor(index: number): string {
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length]
}
