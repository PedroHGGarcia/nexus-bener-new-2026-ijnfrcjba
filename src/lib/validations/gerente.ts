import { z } from 'zod'

export const gerenteSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  cargo: z.string().optional().default(''),
  email: z.string().min(1, 'E-mail é obrigatório').email('E-mail inválido'),
  celular: z.string().optional().default(''),
  rd_station_id: z.string().optional().default(''),
  usuario: z.string().optional().default(''),
  categoria_restrita_id: z.string().nullable().optional().default(null),
  status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
})

export type GerenteFormValues = z.infer<typeof gerenteSchema>
