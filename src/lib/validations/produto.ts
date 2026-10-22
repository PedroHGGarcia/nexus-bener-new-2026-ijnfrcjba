import { z } from 'zod'

export const produtoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  categoria: z.string().optional().nullable().default(null),
  status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
  descricao: z.string().optional().default(''),
  especificacoes: z.record(z.string(), z.string()).optional().default({}),
  fotos: z.array(z.string()).optional().nullable().default(null),
})

export type ProdutoFormValues = z.infer<typeof produtoSchema>
