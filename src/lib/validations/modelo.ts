import { z } from 'zod'

export const modeloSchema = z
  .object({
    nome: z.string().min(1, 'Nome é obrigatório'),
    produto: z.string().optional().nullable().default(null),
    marca: z.string().optional().nullable().default(null),
    status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
  })
  .refine((data) => !!(data.produto || data.marca), {
    message: 'Informe pelo menos uma Marca ou um Produto para este modelo.',
    path: ['vinculo'],
  })

export type ModeloFormValues = z.infer<typeof modeloSchema>
