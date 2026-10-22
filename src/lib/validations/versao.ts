import { z } from 'zod'

export const versaoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  modelo: z.string().min(1, 'Modelo é obrigatório'),
  reg: z.string().optional().default(''),
  cod_erp: z.string().optional().default(''),
  moeda: z.enum(['BRL', 'USD', 'EUR']).default('BRL'),
  valor: z.coerce.number().min(0).default(0),
  tem_fator: z.boolean().default(false),
  fator_nac: z.coerce.number().min(0).default(1),
  tem_estoque: z.boolean().default(false),
  desconto_max_representante: z.coerce.number().min(0).default(0),
  desconto_max_bener: z.coerce.number().min(0).default(0),
  estoque_total: z.coerce.number().min(0).default(0),
  estoque_bloqueado: z.coerce.number().min(0).default(0),
  estoque_reservado: z.coerce.number().min(0).default(0),
  estoque_disponivel: z.coerce.number().min(0).default(0),
  acessorios_standards: z.string().optional().default(''),
  caracteristicas_construtivas: z.string().optional().default(''),
  especificacoes_tecnicas: z.string().optional().default(''),
  tipos_proposta: z.array(z.string()).default([]),
  nome_abreviado: z.string().optional().default(''),
  status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
  categoria_id: z.string().uuid().nullable().optional().default(null),
  galeria: z.any().nullable().optional(),
})

export type VersaoFormValues = z.infer<typeof versaoSchema>
