import { z } from 'zod'

export const marcaSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  reg: z.number().optional().nullable(),
  cod: z.number().optional().nullable(),
  site: z.string().optional().nullable(),
  pais: z.string().optional().nullable(),
  status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
})

export type MarcaFormValues = z.infer<typeof marcaSchema>
