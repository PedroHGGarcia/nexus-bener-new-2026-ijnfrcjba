export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i)
  }
  const digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (parseInt(digits[9]) !== digit1) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i)
  }
  const digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (parseInt(digits[10]) !== digit2) return false

  return true
}

/**
 * Aplica máscara progressiva de CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00)
 * de acordo com a quantidade de dígitos numéricos digitados (até 14).
 */
export function formatCpfCnpj(value: string | null | undefined): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 14)

  if (digits.length <= 11) {
    // Formato CPF
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
  }

  // Formato CNPJ
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5')
}

/**
 * Valida se a string é um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.
 */
export function isValidCpfOrCnpj(value: string | null | undefined): boolean {
  if (!value) return false
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11) return isValidCPF(digits)
  if (digits.length === 14) return isValidCNPJ(digits)
  return false
}

/**
 * Aplica máscara progressiva de telefone brasileiro:
 * Fixo (10 dígitos): (00) 0000-0000
 * Celular (11 dígitos): (00) 00000-0000
 */
export function formatPhoneBR(value: string | null | undefined): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 11)

  if (digits.length <= 2) {
    return digits.length > 0 ? `(${digits}` : ''
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  }
  if (digits.length <= 10) {
    // (xx) xxxx-xxxx
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  // 11 dígitos: celular (xx) xxxxx-xxxx
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

/**
 * Valida celular brasileiro com DDD obrigatório:
 * Deve ter 11 dígitos, sendo DDD entre 11 e 99 e primeiro dígito após DDD igual a 9.
 * Ex.: (11) 98765-4321
 */
export function isValidCelularBR(value: string | null | undefined): boolean {
  if (!value) return false
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11) return false
  const ddd = parseInt(digits.slice(0, 2), 10)
  if (ddd < 11 || ddd > 99) return false
  // Celular brasileiro começa com 9
  if (digits[2] !== '9') return false
  return true
}

export function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return false
  if (/^(\d)\1{13}$/.test(digits)) return false

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * weights1[i]
  }
  const digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (parseInt(digits[12], 10) !== digit1) return false

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  sum = 0
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i], 10) * weights2[i]
  }
  const digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (parseInt(digits[13], 10) !== digit2) return false

  return true
}

/**
 * Formata estritamente como CNPJ: 00.000.000/0000-00 progressivo até 14 dígitos.
 * Aceita string colada com ou sem pontuação.
 */
export function formatCNPJ(value: string | null | undefined): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 14)

  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

/**
 * Formata CEP no padrão 00000-000 progressivo.
 */
export function formatCEP(value: string | null | undefined): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}
