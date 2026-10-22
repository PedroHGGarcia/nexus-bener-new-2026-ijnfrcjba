import { z } from 'zod'

export const categoriaProdutoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  logo: z.string().optional().default(''),
  status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
})

export type CategoriaProdutoFormValues = z.infer<typeof categoriaProdutoSchema>
