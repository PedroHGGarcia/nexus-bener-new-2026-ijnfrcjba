import { supabase } from '@/lib/supabase/client'
import type { ModeloImagem } from '@/types/modelo'

const STORAGE_BUCKET = 'versao-images'
const TABLE = 'modelo_imagens'

export interface UploadModeloImageParams {
  file: File
  modeloId: string
  descricao?: string
  tipoDocumento?: string
}

/**
 * Uploads an image file to Supabase Storage and records it in public.modelo_imagens.
 */
export async function uploadModeloImagem({
  file,
  modeloId,
  descricao,
  tipoDocumento = 'plaqueta',
}: UploadModeloImageParams): Promise<ModeloImagem> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Clean filename for storage path
  const cleanBase = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `modelos/${modeloId}/${Date.now()}-${cleanBase}`

  const { error: uploadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      upsert: true,
      cacheControl: '3600',
    })

  if (uploadErr) {
    throw new Error(`Falha no upload da imagem técnica: ${uploadErr.message}`)
  }

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
  const publicUrl = urlData.publicUrl

  const { data: record, error: dbErr } = await supabase
    .from(TABLE)
    .insert({
      modelo_id: modeloId,
      nome_arquivo: file.name,
      url: publicUrl,
      descricao: descricao?.trim() || null,
      tipo_documento: tipoDocumento || 'plaqueta',
      tamanho_bytes: file.size,
      criado_por: user?.id ?? null,
    })
    .select('*')
    .single()

  if (dbErr) {
    throw new Error(`Falha ao registrar imagem no banco: ${dbErr.message}`)
  }

  return record as ModeloImagem
}

/**
 * Lists technical images for one or all models, optionally filtered by modeloIds.
 */
export async function fetchModeloImagens(modeloId?: string): Promise<ModeloImagem[]> {
  let query = supabase
    .from(TABLE)
    .select(
      `
      id, modelo_id, nome_arquivo, url, descricao, tipo_documento, tamanho_bytes, criado_por, created_at, updated_at,
      modelo:modelos (id, nome)
    `,
    )
    .order('created_at', { ascending: false })

  if (modeloId) {
    query = query.eq('modelo_id', modeloId)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Erro ao carregar imagens do modelo: ${error.message}`)
  }

  return (data || []) as unknown as ModeloImagem[]
}

/**
 * Lists technical images for multiple models simultaneously (useful when multiple models are selected).
 */
export async function fetchModeloImagensByModelos(modeloIds: string[]): Promise<ModeloImagem[]> {
  if (!modeloIds || modeloIds.length === 0) return []

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      `
      id, modelo_id, nome_arquivo, url, descricao, tipo_documento, tamanho_bytes, criado_por, created_at, updated_at,
      modelo:modelos (id, nome)
    `,
    )
    .in('modelo_id', modeloIds)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao carregar imagens dos modelos: ${error.message}`)
  }

  return (data || []) as unknown as ModeloImagem[]
}

/**
 * Updates description or document type of an existing model image.
 */
export async function updateModeloImagem(
  id: string,
  updates: { descricao?: string | null; tipo_documento?: string | null },
): Promise<ModeloImagem> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar imagem: ${error.message}`)
  }

  return data as ModeloImagem
}

/**
 * Deletes a technical image from the database and storage.
 */
export async function deleteModeloImagem(item: ModeloImagem): Promise<void> {
  // Extract storage path from url if possible
  try {
    const url = item.url
    const marker = `${STORAGE_BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx !== -1) {
      const storagePath = decodeURIComponent(url.substring(idx + marker.length))
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
    }
  } catch {
    // Ignore storage deletion errors to ensure db record is removed
  }

  const { error } = await supabase.from(TABLE).delete().eq('id', item.id)
  if (error) {
    throw new Error(`Erro ao remover imagem do modelo: ${error.message}`)
  }
}
