import { z } from 'zod'

export { clienteSchema, type ClienteFormValues } from './validations/cliente'
export { produtoSchema, type ProdutoFormValues } from './validations/produto'

import { isValidCPF, isValidCNPJ, isValidCelularBR } from '@/lib/cpf-cnpj'

export const userSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  role: z.string().min(1, 'Perfil é obrigatório'),
  setor: z.string().optional().default(''),
  status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
  celular: z
    .string()
    .min(1, 'Celular é obrigatório')
    .refine((val) => isValidCelularBR(val), 'Informe um celular válido com DDD'),
  documento: z
    .string()
    .min(1, 'CPF/CNPJ é obrigatório')
    .refine((val) => {
      const digits = val.replace(/\D/g, '')
      if (digits.length === 11) return isValidCPF(digits)
      if (digits.length === 14) return isValidCNPJ(digits)
      return false
    }, 'Informe um CPF ou CNPJ válido'),
  menuAccess: z.array(z.string()).default([]),
})

export type UserFormValues = z.infer<typeof userSchema>

export const propostaSchema = z.object({
  cliente: z.string().min(1, 'Cliente é obrigatório'),
  versao: z.string().optional().nullable(),
  representante: z.string().optional().nullable(),
  gerente: z.string().optional().nullable(),
  descricao_proposta: z.string().optional().default(''),
  especificacoes_tecnicas: z.string().optional().default(''),
  moeda: z.string().default('BRL'),
  valor_sem_desconto: z.number().nonnegative().default(0),
  percentual_desconto: z.number().min(0).max(100).default(0),
  valor_final: z.number().nonnegative().default(0),
  preco_especial: z.number().nonnegative().optional().nullable(),
  prazo_entrega: z.string().optional().default(''),
  condicoes_pagamento: z.string().optional().default(''),
  validade_oferta: z.string().optional().default(''),
  modelo_licitacao: z.boolean().default(false),
  status: z.string().default('Em Analise'),
})

export type PropostaFormValues = z.infer<typeof propostaSchema>

export const projetoSchema = z.object({
  nome: z.string().min(1, 'Nome do projeto é obrigatório'),
  descricao: z.string().optional().default(''),
  cliente: z.string().min(1, 'Cliente é obrigatório'),
  status: z.enum(['Em Andamento', 'Concluido', 'Cancelado']).default('Em Andamento'),
})

export type ProjetoFormValues = z.infer<typeof projetoSchema>

export const eventoSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().optional().default(''),
  data_inicio: z.string().min(1, 'Data de início é obrigatória'),
  data_fim: z.string().optional().default(''),
  local: z.string().optional().default(''),
  status: z.string().default('Agendado'),
})

export type EventoFormValues = z.infer<typeof eventoSchema>

export const versaoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  modelo: z.string().min(1, 'Modelo é obrigatório'),
  reg: z.string().optional().default(''),
  cod_erp: z.string().optional().default(''),
  moeda: z.string().default('BRL'),
  valor: z.number().nonnegative().default(0),
  fator_nac: z.number().min(0).default(1),
  tem_fator: z.boolean().default(false),
  tem_estoque: z.boolean().default(false),
  status: z.string().default('Ativo'),
})

export type VersaoFormValues = z.infer<typeof versaoSchema>

export const acessorioSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  tipo: z.string().optional().default(''),
  moeda: z.string().default('BRL'),
  valor: z.number().nonnegative().default(0),
  fator_nac: z.number().min(0).default(1),
  status: z.string().default('Ativo'),
  especificacoes_tecnicas: z.string().optional().default(''),
})

export type AcessorioFormValues = z.infer<typeof acessorioSchema>
