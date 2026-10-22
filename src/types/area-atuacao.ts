export interface AreaAtuacao {
  id: string
  representante: string | null
  geometria: GeoJSON.Geometry | null
  cor: string | null
  created_at: string | null
  updated_at: string | null
}

export type AreaAtuacaoInsert = Omit<AreaAtuacao, 'id' | 'created_at' | 'updated_at'>
export type AreaAtuacaoUpdate = Partial<AreaAtuacaoInsert> & { id: string }

export interface TerritoryWithRep extends AreaAtuacao {
  representante_nome?: string | null
  representante_sigla?: string | null
}

export interface MapLayerConfig {
  territories: boolean
  clients: boolean
  baseMap: boolean
}

export interface KmlImportResult {
  fileName: string
  success: boolean
  error?: string
  territoryId?: string
}

export interface KmlImportSummary {
  total: number
  success: number
  failed: number
  results: KmlImportResult[]
}
