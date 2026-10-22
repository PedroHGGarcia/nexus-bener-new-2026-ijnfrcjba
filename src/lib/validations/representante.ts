import { z } from 'zod'

const emailSchema = z.string().email('E-mail inválido').or(z.literal(''))

export const representanteSchema = z.object({
  reg: z.number().nullable().optional(),
  cod: z.string().optional().default(''),
  fantasia: z.string().min(1, 'Nome Fantasia é obrigatório'),
  sigla: z.string().optional().default(''),
  regiao: z.string().optional().default(''),
  status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
  gerente_id: z.string().nullable().optional().default(null),
  documento: z.string().optional().default(''),
  rd_station_id: z.string().optional().default(''),
  razao_social: z.string().optional().default(''),
  email: z.string().email('E-mail inválido').or(z.literal('')).optional().default(''),
  telefone: z.string().optional().default(''),
  celular: z.string().optional().default(''),
  telefone_principal: z.string().optional().default(''),
  telefones: z.array(z.string()).default([]),
  emails: z
    .array(emailSchema)
    .default([])
    .refine(
      (emails) => emails.every((e) => e === '' || z.string().email().safeParse(e).success),
      'Um ou mais e-mails são inválidos',
    ),
  cep: z.string().optional().default(''),
  estado: z.string().optional().default(''),
  estados_atuacao: z.array(z.string()).default([]),
  cidade: z.string().optional().default(''),
  bairro: z.string().optional().default(''),
  logradouro: z.string().optional().default(''),
  numero: z.string().optional().default(''),
  complementos: z.string().optional().default(''),
  endereco: z.string().optional().default(''),
  categoriaIds: z.array(z.string()).default([]),
  regiaoIds: z.array(z.string()).default([]),
})

export type RepresentanteFormValues = z.infer<typeof representanteSchema>
