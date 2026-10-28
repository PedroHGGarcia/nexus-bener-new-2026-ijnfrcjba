import { z } from 'zod'

export const versaoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  modelo: z.string().min(1, 'Modelo é obrigatório'),
  reg: z
    .any()
    .optional()
    .transform((v) => (v != null ? String(v) : '')),
  cod_erp: z
    .any()
    .optional()
    .transform((v) => (v != null ? String(v) : '')),
  moeda: z
    .string()
    .optional()
    .default('BRL')
    .transform((m) => (m === 'USD' || m === 'EUR' ? m : 'BRL')),
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
  tipos_proposta: z
    .array(z.string())
    .optional()
    .default([])
    .transform((tp) => (Array.isArray(tp) ? tp : [])),
  nome_abreviado: z.string().optional().default(''),
  status: z
    .string()
    .optional()
    .default('Ativo')
    .transform((s) => (s === 'Inativo' || s === 'I' ? 'Inativo' : 'Ativo')),
  categoria_id: z
    .string()
    .nullable()
    .optional()
    .transform((v) =>
      !v || v === 'none' || (typeof v === 'string' && v.trim() === '') ? null : v,
    ),
  galeria: z.any().nullable().optional(),
})

export type VersaoFormValues = z.infer<typeof versaoSchema>
