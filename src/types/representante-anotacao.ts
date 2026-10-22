export interface RepresentanteAnotacao {
  id: string
  representante_id: string
  ano_referencia: number
  titulo: string
  texto: string
  autor_id: string | null
  autor_nome: string | null
  created_at: string
  updated_at: string
}

export type RepresentanteAnotacaoInsert = Omit<
  RepresentanteAnotacao,
  'id' | 'created_at' | 'updated_at'
>

export type RepresentanteAnotacaoUpdate = Partial<
  Omit<RepresentanteAnotacao, 'id' | 'representante_id' | 'created_at' | 'updated_at'>
> & { id: string }
