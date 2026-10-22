import Papa from 'papaparse'

export interface TargetClienteBaseAntiga {
  nome: string
  cnpj: string
  email: string
  telefone: string
  contato: string
  endereco: string
  cidade: string
  uf: string
  cep: string
}

export const TARGET_COLUMNS: Array<{
  key: keyof TargetClienteBaseAntiga
  label: string
  required: boolean
  description: string
}> = [
  { key: 'nome', label: 'Nome / Razão Social', required: false, description: 'Nome da empresa' },
  {
    key: 'cnpj',
    label: 'CNPJ',
    required: true,
    description: 'Chave única (somente dígitos salvos)',
  },
  { key: 'email', label: 'E-mail', required: false, description: 'Endereço de e-mail de contato' },
  { key: 'telefone', label: 'Telefone', required: false, description: 'Telefone principal' },
  { key: 'contato', label: 'Contato', required: false, description: 'Pessoa ou setor de contato' },
  { key: 'endereco', label: 'Endereço', required: false, description: 'Logradouro / Rua e número' },
  { key: 'cidade', label: 'Cidade', required: false, description: 'Município' },
  { key: 'uf', label: 'UF', required: false, description: 'Sigla do Estado (2 caracteres)' },
  {
    key: 'cep',
    label: 'CEP',
    required: false,
    description: 'Código postal (somente dígitos salvos)',
  },
]

export function cleanOnlyNumbers(val?: string | null): string {
  if (!val) return ''
  return String(val).replace(/\D/g, '')
}

export function normalizeHeaderKey(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function autoDetectColumnMapping(
  headers: string[],
): Record<keyof TargetClienteBaseAntiga, string> {
  const mapping: Record<keyof TargetClienteBaseAntiga, string> = {
    nome: '',
    cnpj: '',
    email: '',
    telefone: '',
    contato: '',
    endereco: '',
    cidade: '',
    uf: '',
    cep: '',
  }

  headers.forEach((h) => {
    const norm = normalizeHeaderKey(h)
    if (
      !mapping.nome &&
      ['nome', 'razaosocial', 'nomefantasia', 'cliente', 'empresa', 'razao'].includes(norm)
    ) {
      mapping.nome = h
    } else if (!mapping.cnpj && ['cnpj', 'cpfcnpj', 'documento', 'cgc'].includes(norm)) {
      mapping.cnpj = h
    } else if (!mapping.email && ['email', 'emailfiscal', 'mail', 'correio'].includes(norm)) {
      mapping.email = h
    } else if (
      !mapping.telefone &&
      ['telefone', 'fone', 'tel', 'celular', 'telefone1', 'contatofone'].includes(norm)
    ) {
      mapping.telefone = h
    } else if (
      !mapping.contato &&
      ['contato', 'pessoadecontato', 'responsavel', 'nomedecontato'].includes(norm)
    ) {
      mapping.contato = h
    } else if (
      !mapping.endereco &&
      ['endereco', 'logradouro', 'rua', 'end', 'enderecocompleto'].includes(norm)
    ) {
      mapping.endereco = h
    } else if (!mapping.cidade && ['cidade', 'municipio'].includes(norm)) {
      mapping.cidade = h
    } else if (!mapping.uf && ['uf', 'estado', 'siglauf'].includes(norm)) {
      mapping.uf = h
    } else if (!mapping.cep && ['cep', 'codigopostal'].includes(norm)) {
      mapping.cep = h
    }
  })

  return mapping
}

export function parseCSVFile(
  file: File,
  onComplete: (data: { headers: string[]; rawRows: Record<string, string>[] }) => void,
  onError: (error: Error) => void,
) {
  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
    complete: (results) => {
      const headers = results.meta.fields || []
      const rawRows = (results.data || []).map((row) => {
        const cleaned: Record<string, string> = {}
        for (const [k, v] of Object.entries(row)) {
          cleaned[k.trim()] = v !== undefined && v !== null ? String(v).trim() : ''
        }
        return cleaned
      })
      onComplete({ headers, rawRows })
    },
    error: (err) => {
      onError(new Error(err.message || 'Erro ao processar arquivo CSV.'))
    },
  })
}

export function transformRowWithMapping(
  row: Record<string, string>,
  mapping: Record<keyof TargetClienteBaseAntiga, string>,
): TargetClienteBaseAntiga {
  const getVal = (targetField: keyof TargetClienteBaseAntiga): string => {
    const csvCol = mapping[targetField]
    if (!csvCol || !row[csvCol]) return ''
    return String(row[csvCol]).trim()
  }

  const rawCnpj = getVal('cnpj')
  const rawCep = getVal('cep')
  const rawUf = getVal('uf')

  return {
    nome: getVal('nome'),
    cnpj: cleanOnlyNumbers(rawCnpj),
    email: getVal('email'),
    telefone: getVal('telefone'),
    contato: getVal('contato'),
    endereco: getVal('endereco'),
    cidade: getVal('cidade'),
    uf: rawUf ? rawUf.toUpperCase().slice(0, 2) : '',
    cep: cleanOnlyNumbers(rawCep),
  }
}
