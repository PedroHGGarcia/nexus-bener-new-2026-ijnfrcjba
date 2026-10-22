import { parseKml, validateGeometry, toGeoJson, type ParsedGeometry } from '@/lib/kml-parser'
import {
  getBoundingBox,
  createProjector,
  polygonToSvgPath,
  type BoundingBox,
} from '@/lib/geo-projection'

export async function parseKmlFile(file: File): Promise<ParsedGeometry[]> {
  const text = await file.text()
  return parseKml(text)
}

export function getValidGeometries(geometries: ParsedGeometry[]): ParsedGeometry[] {
  return geometries.filter((g) => validateGeometry(g))
}

export function geometriesToGeoJson(geometries: ParsedGeometry[]): GeoJSON.Geometry[] {
  return geometries.map((g) => toGeoJson(g))
}

export function getSvgPaths(
  geometries: GeoJSON.Geometry[],
  width: number,
  height: number,
): string[] {
  if (geometries.length === 0) return []
  const bbox = getBoundingBox(geometries)
  const project = createProjector(bbox, width, height)
  return geometries
    .filter((g): g is GeoJSON.Polygon => g.type === 'Polygon')
    .map((g) => polygonToSvgPath(g, project))
}

export function getBounds(geometries: GeoJSON.Geometry[]): BoundingBox {
  return getBoundingBox(geometries)
}

export function summarizeGeometries(geometries: ParsedGeometry[]): {
  total: number
  valid: number
  invalid: number
} {
  const valid = getValidGeometries(geometries)
  return {
    total: geometries.length,
    valid: valid.length,
    invalid: geometries.length - valid.length,
  }
}
