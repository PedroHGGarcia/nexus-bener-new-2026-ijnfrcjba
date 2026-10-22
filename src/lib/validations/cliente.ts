import { z } from 'zod'
import { isValidCPF, isValidCNPJ } from '@/lib/cpf-cnpj'

const contatoAdicionalSchema = z.object({
  id: z.string(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  cargo: z.string().optional().default(''),
  telefone: z.string().optional().default(''),
  email: z.string().email('E-mail inválido').or(z.literal('')).optional().default(''),
})

export const clienteSchema = z.object({
  fantasia: z.string().min(1, 'Nome Fantasia é obrigatório'),
  razao_social: z.string().optional().default(''),
  documento: z
    .string()
    .min(1, 'CPF/CNPJ é obrigatório')
    .refine((val) => {
      const digits = val.replace(/\D/g, '')
      if (digits.length === 11) return isValidCPF(digits)
      if (digits.length === 14) return isValidCNPJ(digits)
      return false
    }, 'CPF/CNPJ inválido — verifique os dígitos'),
  status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
  contato: z.string().optional().default(''),
  telefone: z.string().optional().default(''),
  telefone_2: z.string().optional().default(''),
  telefone_3: z.string().optional().default(''),
  celular: z.string().optional().default(''),
  email: z.string().email('E-mail inválido').or(z.literal('')).optional().default(''),
  email_fiscal: z.string().email('E-mail fiscal inválido').or(z.literal('')).optional().default(''),
  cep: z.string().optional().default(''),
  estado: z.string().optional().default(''),
  cidade: z.string().optional().default(''),
  bairro: z.string().optional().default(''),
  logradouro: z.string().optional().default(''),
  numero: z.string().optional().default(''),
  complementos: z.string().optional().default(''),
  contatos_adicionais: z.array(contatoAdicionalSchema).optional().default([]),
  limite_credito: z.number().nonnegative().optional().nullable(),
  dt_cad: z.string().optional().default(''),
  maquina_interesse: z.string().optional().default(''),
})

export type ClienteFormValues = z.infer<typeof clienteSchema>
