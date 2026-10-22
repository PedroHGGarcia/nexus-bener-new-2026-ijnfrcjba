import { supabase } from '@/lib/supabase/client'
import { parseKml, validateGeometry, toGeoJson } from '@/lib/kml-parser'
import { getDefaultColor } from '@/lib/kml-parser'
import type { ServiceResult } from '@/lib/utils'

export interface KmlImportResult {
  fileName: string
  territoryId?: string
  geometryCount: number
  error?: string
}

export async function importKmlFile(
  file: File,
  representanteId: string | null,
): Promise<ServiceResult<KmlImportResult>> {
  try {
    const text = await file.text()
    const geometries = parseKml(text)
    const valid = geometries.filter((g) => validateGeometry(g))
    if (valid.length === 0) {
      return {
        ok: false,
        error: 'Nenhuma geometria válida encontrada no arquivo KML.',
      }
    }
    const color = getDefaultColor(Date.now() % 10)
    const geoJson = toGeoJson(valid[0])
    const { data, error } = await supabase
      .from('area_atuacao')
      .insert({
        representante: representanteId ?? undefined,
        geometria: geoJson as unknown as import('@/lib/supabase/types').Json,
        cor: color,
      } as unknown as import('@/lib/supabase/types').Database['public']['Tables']['area_atuacao']['Insert'])
      .select()
      .single()
    if (error) return { ok: false, error: error.message }
    return {
      ok: true,
      data: {
        fileName: file.name,
        territoryId: data.id,
        geometryCount: valid.length,
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Erro ao importar arquivo KML.',
    }
  }
}

export async function importMultipleKml(
  files: File[],
  representanteId: string | null,
): Promise<ServiceResult<KmlImportResult[]>> {
  const results: KmlImportResult[] = []
  for (const file of files) {
    const r = await importKmlFile(file, representanteId)
    if (r.ok) {
      results.push(r.data)
    } else {
      results.push({
        fileName: file.name,
        geometryCount: 0,
        error: (r as { ok: false; error: string }).error,
      })
    }
  }
  return { ok: true, data: results }
}
