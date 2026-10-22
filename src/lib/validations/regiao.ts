import { z } from 'zod'

export const regiaoSchema = z
  .object({
    nome: z.string().min(1, 'Nome da região é obrigatório'),
    uf: z.string().min(2, 'Selecione o estado (UF)'),
    todo_o_estado: z.boolean().default(true),
    cidades: z.array(z.string()).default([]),
    status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
  })
  .refine(
    (data) => {
      // Se não for todo o estado, deve selecionar ao menos uma cidade
      if (!data.todo_o_estado) {
        return Array.isArray(data.cidades) && data.cidades.length > 0
      }
      return true
    },
    {
      message: 'Selecione ao menos uma cidade ou marque a opção de todo o estado',
      path: ['cidades'],
    },
  )

export type RegiaoFormValues = z.infer<typeof regiaoSchema>
