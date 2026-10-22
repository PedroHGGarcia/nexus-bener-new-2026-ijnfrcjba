import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Loader2, AlertCircle, Database } from 'lucide-react'
import { FormattedNumberInput } from '@/components/shared/formatted-number-input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { ClienteFormValues, clienteSchema } from '@/lib/validations/cliente'
import { Cliente, ClienteContatoInput } from '@/types/cliente'
import { formatCpfCnpj, formatCEP, formatPhoneBR, isValidCNPJ } from '@/lib/cpf-cnpj'
import {
  insertCliente,
  updateCliente,
  checkDocumentoDuplicate,
  lookupCep,
  lookupCnpj,
  fetchContatosByCliente,
  syncClienteContatos,
} from '@/services/clientes'
import { Star, UserCheck } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Cliente | null
  onSaved: (cliente?: Cliente) => void
  defaultTab?: 'principais' | 'contato' | 'endereco' | 'contatos_multiplos'
}

function emptyForm(): ClienteFormValues {
  return {
    fantasia: '',
    razao_social: '',
    documento: '',
    status: 'Ativo',
    contato: '',
    telefone: '',
    telefone_2: '',
    telefone_3: '',
    celular: '',
    email: '',
    email_fiscal: '',
    cep: '',
    estado: '',
    cidade: '',
    bairro: '',
    logradouro: '',
    numero: '',
    complementos: '',
    contatos_adicionais: [],
    limite_credito: null,
    dt_cad: new Date().toISOString().split('T')[0],
    maquina_interesse: '',
  }
}

function clienteToForm(c: Cliente): ClienteFormValues {
  return {
    fantasia: c.fantasia,
    razao_social: c.razao_social ?? '',
    documento: c.documento ?? '',
    status: c.status as 'Ativo' | 'Inativo',
    contato: c.contato ?? '',
    telefone: c.telefone ?? '',
    telefone_2: c.telefone_2 ?? '',
    telefone_3: c.telefone_3 ?? '',
    celular: c.celular ?? '',
    email: c.email ?? '',
    email_fiscal: c.email_fiscal ?? '',
    cep: c.cep ?? '',
    estado: c.estado ?? '',
    cidade: c.cidade ?? '',
    bairro: c.bairro ?? '',
    logradouro: c.logradouro ?? '',
    numero: c.numero ?? '',
    complementos: c.complementos ?? '',
    contatos_adicionais: c.contatos_adicionais ?? [],
    limite_credito: c.limite_credito ?? null,
    dt_cad: c.dt_cad ?? '',
    maquina_interesse: c.maquina_interesse ?? '',
  }
}

export function ClienteFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
  defaultTab = 'principais',
}: Props) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab)
  const [form, setForm] = useState<ClienteFormValues>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState('')
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjError, setCnpjError] = useState('')
  const [cnpjSource, setCnpjSource] = useState<string | null>(null)
  const [cepSource, setCepSource] = useState<string | null>(null)
  const [baseAntigaFields, setBaseAntigaFields] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const cnpjTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCnpjLookedUpRef = useRef<string>('')
  const cepAutoFetchedRef = useRef(false)

  // R8: múltiplos contatos persistidos na tabela cliente_contatos
  const [contatosList, setContatosList] = useState<ClienteContatoInput[]>([])
  const [loadingContatos, setLoadingContatos] = useState(false)

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab)
      const initial = editing ? clienteToForm(editing) : emptyForm()
      // Garante formatação inicial com máscara caso venha cru do banco
      if (initial.documento) {
        initial.documento = formatCpfCnpj(initial.documento)
      }
      if (initial.cep) {
        initial.cep = formatCEP(initial.cep)
      }
      setForm(initial)
      setErrors({})
      setCnpjSource(null)
      setCepSource(null)
      setBaseAntigaFields({})
      lastCnpjLookedUpRef.current = editing?.documento ? editing.documento.replace(/\D/g, '') : ''
      cepAutoFetchedRef.current = false

      // Carregar contatos múltiplos de cliente_contatos (R8)
      if (editing?.id) {
        setLoadingContatos(true)
        fetchContatosByCliente(editing.id)
          .then((rows) => {
            if (rows && rows.length > 0) {
              setContatosList(
                rows.map((r) => ({
                  id: r.id,
                  nome: r.nome,
                  email: r.email,
                  telefone: r.telefone,
                  cargo: r.cargo,
                  is_principal: r.is_principal,
                })),
              )
            } else {
              // Fallback nos dados primários do cliente
              setContatosList([
                {
                  id: `tmp-primario`,
                  nome: editing.contato || editing.fantasia || 'Contato Principal',
                  email: editing.email || null,
                  telefone: editing.celular || editing.telefone || null,
                  cargo: 'Principal',
                  is_principal: true,
                },
              ])
            }
          })
          .catch(() => {
            setContatosList([])
          })
          .finally(() => {
            setLoadingContatos(false)
          })
      } else {
        // Novo cliente: inicia com 1 contato padrão se vazio
        setContatosList([
          {
            id: `tmp-novo-${Date.now()}`,
            nome: '',
            cargo: '',
            telefone: '',
            email: '',
            is_principal: true,
          },
        ])
      }
    }
  }, [open, editing])
  useEffect(() => {
    if (!open || !editing || cepAutoFetchedRef.current) return

    const cepLimpo = (editing.cep || '').replace(/\D/g, '')
    const semLogradouro = !editing.logradouro || !editing.logradouro.trim()
    const semBairro = !editing.bairro || !editing.bairro.trim()
    const semCidade = !editing.cidade || !editing.cidade.trim()

    if (cepLimpo.length === 8 && semLogradouro && semBairro && semCidade) {
      cepAutoFetchedRef.current = true
      let isCancelled = false

      setCepLoading(true)
      setCepError('')

      lookupCep(cepLimpo)
        .then((addr) => {
          if (isCancelled) return
          setCepLoading(false)
          if (addr) {
            setCepSource(addr.origem || 'externo')
            if (addr.origem === 'base_antiga') {
              setBaseAntigaFields((prev) => ({
                ...prev,
                cep: true,
                logradouro: Boolean(addr.logradouro) || prev.logradouro,
                cidade: Boolean(addr.cidade) || prev.cidade,
                estado: Boolean(addr.estado) || prev.estado,
              }))
            }
            setForm((prev) => ({
              ...prev,
              estado: addr.estado || prev.estado,
              cidade: addr.cidade || prev.cidade,
              bairro: addr.bairro || prev.bairro,
              logradouro: addr.logradouro || prev.logradouro,
              complementos: addr.complemento || prev.complementos,
            }))
            const sourceLabel = addr.origem === 'base_antiga' ? 'Base Bener' : 'ViaCEP'
            toast({
              title: 'Endereço preenchido',
              description: `CEP ${editing.cep} encontrado (${sourceLabel}).`,
            })
          } else {
            setCepError('CEP não encontrado')
          }
        })
        .catch(() => {
          if (isCancelled) return
          setCepLoading(false)
          setCepError('Erro ao buscar CEP')
        })

      return () => {
        isCancelled = true
      }
    }
  }, [open, editing])

  const setField = useCallback((key: keyof ClienteFormValues, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const executeCnpjLookup = useCallback(async (cleanDigits: string, force = false) => {
    if (cleanDigits.length !== 14) return
    if (!force && lastCnpjLookedUpRef.current === cleanDigits) return
    if (!isValidCNPJ(cleanDigits)) {
      setCnpjError('CNPJ inválido (dígitos verificadores)')
      return
    }

    lastCnpjLookedUpRef.current = cleanDigits
    setCnpjLoading(true)
    setCnpjError('')

    try {
      const data = await lookupCnpj(cleanDigits)
      if (data) {
        setCnpjSource(data.origem || 'externo')
        if (data.origem === 'base_antiga') {
          const filled: Record<string, boolean> = {}
          if (data.nome_fantasia || data.razao_social) {
            filled.fantasia = true
            filled.razao_social = true
          }
          if (data.contato) filled.contato = true
          if (data.logradouro) filled.logradouro = true
          if (data.municipio) filled.cidade = true
          if (data.uf) filled.estado = true
          if (data.cep) filled.cep = true
          if (data.email) filled.email = true
          if (data.telefone || data.ddd) filled.telefone = true
          setBaseAntigaFields(filled)
        } else {
          setBaseAntigaFields({})
        }

        const cleanCep = data.cep ? data.cep.replace(/\D/g, '') : ''
        const maskedCep = cleanCep ? formatCEP(cleanCep) : ''
        const rawTelefone = [data.ddd, data.telefone].filter(Boolean).join(' ')
        const maskedTelefone = rawTelefone ? formatPhoneBR(rawTelefone) : ''

        // NÃO sobrescreve campos que já tenham sido preenchidos manualmente pelo usuário
        setForm((prev) => ({
          ...prev,
          razao_social: prev.razao_social?.trim()
            ? prev.razao_social
            : data.razao_social || prev.razao_social,
          fantasia: prev.fantasia?.trim()
            ? prev.fantasia
            : data.nome_fantasia || data.razao_social || prev.fantasia,
          contato: prev.contato?.trim() ? prev.contato : data.contato || prev.contato,
          logradouro: prev.logradouro?.trim()
            ? prev.logradouro
            : data.logradouro || prev.logradouro,
          numero: prev.numero?.trim() ? prev.numero : data.numero || prev.numero,
          complementos: prev.complementos?.trim()
            ? prev.complementos
            : data.complemento || prev.complementos,
          bairro: prev.bairro?.trim() ? prev.bairro : data.bairro || prev.bairro,
          cidade: prev.cidade?.trim() ? prev.cidade : data.municipio || prev.cidade,
          estado: prev.estado?.trim() ? prev.estado : data.uf ? data.uf.toUpperCase() : prev.estado,
          cep: prev.cep?.trim() ? prev.cep : maskedCep || prev.cep,
          email: prev.email?.trim() ? prev.email : data.email || prev.email,
          telefone: prev.telefone?.trim()
            ? prev.telefone
            : maskedTelefone || rawTelefone || prev.telefone,
        }))

        const sourceLabel =
          data.origem === 'base_antiga'
            ? 'Base Bener'
            : data.origem === 'receitaws'
              ? 'ReceitaWS'
              : 'BrasilAPI'

        toast({
          title: 'Dados do CNPJ preenchidos',
          description: `CNPJ ${formatCpfCnpj(cleanDigits)} localizado (${sourceLabel}).`,
        })

        // Se o CNPJ trouxe CEP e o endereço ainda precisa de complemento via CEP
        if (cleanCep.length === 8) {
          lookupCep(cleanCep)
            .then((addr) => {
              if (addr) {
                setForm((prev) => ({
                  ...prev,
                  logradouro: prev.logradouro?.trim()
                    ? prev.logradouro
                    : addr.logradouro || prev.logradouro,
                  bairro: prev.bairro?.trim() ? prev.bairro : addr.bairro || prev.bairro,
                  cidade: prev.cidade?.trim() ? prev.cidade : addr.cidade || prev.cidade,
                  estado: prev.estado?.trim() ? prev.estado : addr.estado || prev.estado,
                  complementos: prev.complementos?.trim()
                    ? prev.complementos
                    : addr.complemento || prev.complementos,
                }))
              }
            })
            .catch(() => {
              // Silencioso, dados do CNPJ já foram usados
            })
        }
      } else {
        setCnpjError('CNPJ não encontrado nas bases públicas')
        toast({
          title: 'CNPJ não encontrado',
          description: 'Não foi possível obter dados automáticos. Preencha manualmente.',
          variant: 'destructive',
        })
      }
    } catch {
      setCnpjError('Falha ao consultar CNPJ')
    } finally {
      setCnpjLoading(false)
    }
  }, [])

  const handleCnpjChange = useCallback(
    (rawValue: string) => {
      const masked = formatCpfCnpj(rawValue)
      setField('documento', masked)
      setCnpjError('')

      const digits = rawValue.replace(/\D/g, '')
      if (digits.length === 14) {
        if (cnpjTimerRef.current) clearTimeout(cnpjTimerRef.current)
        cnpjTimerRef.current = setTimeout(() => {
          executeCnpjLookup(digits)
        }, 400)
      } else {
        if (cnpjTimerRef.current) clearTimeout(cnpjTimerRef.current)
        // Se mudou o CNPJ para outro valor, limpa a referência
        if (lastCnpjLookedUpRef.current && lastCnpjLookedUpRef.current !== digits) {
          lastCnpjLookedUpRef.current = ''
        }
      }
    },
    [setField, executeCnpjLookup],
  )

  const handleCnpjBlur = useCallback(
    (documento: string) => {
      const digits = documento.replace(/\D/g, '')
      if (digits.length === 14 && lastCnpjLookedUpRef.current !== digits) {
        if (cnpjTimerRef.current) clearTimeout(cnpjTimerRef.current)
        executeCnpjLookup(digits)
      }
    },
    [executeCnpjLookup],
  )

  const handleCepBlur = useCallback(async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '')
    if (cleanCep.length !== 8) return
    setCepLoading(true)
    setCepError('')
    const addr = await lookupCep(cleanCep)
    setCepLoading(false)
    if (addr) {
      setCepSource(addr.origem || 'externo')
      if (addr.origem === 'base_antiga') {
        setBaseAntigaFields((prev) => ({
          ...prev,
          cep: true,
          logradouro: Boolean(addr.logradouro) || prev.logradouro,
          cidade: Boolean(addr.cidade) || prev.cidade,
          estado: Boolean(addr.estado) || prev.estado,
        }))
      }
      setForm((prev) => ({
        ...prev,
        estado: addr.estado || prev.estado,
        cidade: addr.cidade || prev.cidade,
        bairro: addr.bairro || prev.bairro,
        logradouro: addr.logradouro || prev.logradouro,
        complementos: addr.complemento || prev.complementos,
      }))
      const sourceLabel = addr.origem === 'base_antiga' ? 'Base Bener' : 'ViaCEP'
      toast({
        title: 'Endereço preenchido',
        description: `CEP ${cep} encontrado (${sourceLabel}).`,
      })
    } else {
      setCepError('CEP não encontrado')
      toast({ title: 'CEP não encontrado', variant: 'destructive' })
    }
  }, [])

  const addContatoItem = () => {
    const novo: ClienteContatoInput = {
      id: `tmp-${Date.now()}`,
      nome: '',
      cargo: '',
      telefone: '',
      email: '',
      is_principal: contatosList.length === 0,
    }
    setContatosList((prev) => [...prev, novo])
  }

  const removeContatoItem = (id?: string) => {
    setContatosList((prev) => {
      const filtered = prev.filter((c) => c.id !== id)
      // Se removeu o principal e ainda há outros, promove o primeiro
      if (filtered.length > 0 && !filtered.some((c) => c.is_principal)) {
        filtered[0] = { ...filtered[0], is_principal: true }
      }
      return filtered
    })
  }

  const updateContatoItem = (
    id: string | undefined,
    key: keyof ClienteContatoInput,
    value: unknown,
  ) => {
    setContatosList((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)))
  }

  const setContatoPrincipal = (id?: string) => {
    setContatosList((prev) =>
      prev.map((c) => ({
        ...c,
        is_principal: c.id === id,
      })),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = clienteSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      })
      setErrors(fieldErrors)
      toast({
        title: 'Erro de validação',
        description: 'Verifique os campos destacados.',
        variant: 'destructive',
      })
      return
    }

    setErrors({})
    const values = result.data

    if (values.documento) {
      const isDup = await checkDocumentoDuplicate(values.documento, editing?.id)
      if (isDup) {
        toast({
          title: 'Documento duplicado',
          description: 'Já existe um cliente com este CPF/CNPJ.',
          variant: 'destructive',
        })
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        ...values,
        contatos_adicionais: values.contatos_adicionais ?? null,
        limite_credito: values.limite_credito ?? null,
      }
      let savedCliente: Cliente | undefined
      if (editing) {
        savedCliente = await updateCliente({ id: editing.id, ...payload })
      } else {
        savedCliente = await insertCliente(payload)
      }

      // R8: Sincronizar contatos múltiplos na tabela cliente_contatos
      if (savedCliente?.id && contatosList.length > 0) {
        try {
          await syncClienteContatos(savedCliente.id, contatosList)
        } catch (contatoErr) {
          console.error('Erro ao sincronizar contatos:', contatoErr)
        }
      }

      toast({
        title: editing ? 'Cliente atualizado com sucesso' : 'Cliente criado com sucesso',
      })
      onSaved(savedCliente)
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 w-full mb-4">
              <TabsTrigger value="principais">Dados Principais</TabsTrigger>
              <TabsTrigger value="contato">Contato</TabsTrigger>
              <TabsTrigger value="endereco">Endereço</TabsTrigger>
              <TabsTrigger value="contatos_multiplos" className="gap-1.5">
                Contatos ({contatosList.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="principais" className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label>Nome Fantasia *</Label>
                  {baseAntigaFields.fantasia && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      <Database className="w-2.5 h-2.5" /> Base Bener
                    </span>
                  )}
                </div>
                <Input
                  value={form.fantasia}
                  onChange={(e) => {
                    setField('fantasia', e.target.value)
                    setBaseAntigaFields((prev) => ({ ...prev, fantasia: false }))
                  }}
                />
                {errors.fantasia && (
                  <p className="text-xs text-destructive mt-1">{errors.fantasia}</p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Razão Social</Label>
                  {baseAntigaFields.razao_social && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      <Database className="w-2.5 h-2.5" /> Base Bener
                    </span>
                  )}
                </div>
                <Input
                  value={form.razao_social}
                  onChange={(e) => {
                    setField('razao_social', e.target.value)
                    setBaseAntigaFields((prev) => ({ ...prev, razao_social: false }))
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1">
                      CPF / CNPJ *
                      {cnpjLoading && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground font-normal ml-1">
                          <Loader2 className="w-3 h-3 inline animate-spin text-primary" />
                          <span className="hidden sm:inline">Buscando dados do CNPJ...</span>
                        </span>
                      )}
                    </Label>
                    <div className="flex items-center gap-1">
                      {cnpjSource === 'base_antiga' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-1.5 py-0.5 rounded cursor-help">
                                <Database className="w-2.5 h-2.5" /> Base Bener
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">Registro localizado na base legada da Bener</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {cnpjSource && cnpjSource !== 'base_antiga' && (
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {cnpjSource === 'receitaws' ? 'ReceitaWS' : 'BrasilAPI'}
                        </span>
                      )}
                    </div>
                  </div>
                  <Input
                    value={form.documento}
                    onChange={(e) => handleCnpjChange(e.target.value)}
                    onBlur={(e) => handleCnpjBlur(e.target.value)}
                    placeholder="00.000.000/0000-00 ou CPF"
                    maxLength={18}
                  />
                  {errors.documento && (
                    <p className="text-xs text-destructive mt-1">{errors.documento}</p>
                  )}
                  {cnpjError && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {cnpjError}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setField('status', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Limite de Crédito (R$)</Label>
                  <FormattedNumberInput
                    value={form.limite_credito ?? 0}
                    onChange={(v) => setField('limite_credito', v || null)}
                    prefix="R$"
                  />
                </div>
                <div>
                  <Label>Data de Cadastro</Label>
                  <Input
                    type="date"
                    value={form.dt_cad}
                    onChange={(e) => setField('dt_cad', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label className="flex items-center justify-between">
                  <span>Máquina de Interesse</span>
                  <span className="text-[11px] text-muted-foreground font-normal">Opcional</span>
                </Label>
                <Textarea
                  value={form.maquina_interesse}
                  onChange={(e) => setField('maquina_interesse', e.target.value)}
                  placeholder="Ex: Torno CNC Bener, Centro de Usinagem 5 Eixos, Laser de Fibra..."
                  rows={2}
                  className="mt-1 text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Anotação prévia sobre o modelo ou tipo de máquina que o cliente possui interesse.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="contato" className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label>Pessoa de Contato</Label>
                  {baseAntigaFields.contato && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      <Database className="w-2.5 h-2.5" /> Base Bener
                    </span>
                  )}
                </div>
                <Input
                  value={form.contato}
                  onChange={(e) => {
                    setField('contato', e.target.value)
                    setBaseAntigaFields((prev) => ({ ...prev, contato: false }))
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Telefone</Label>
                    {baseAntigaFields.telefone && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        <Database className="w-2.5 h-2.5" /> Base Bener
                      </span>
                    )}
                  </div>
                  <Input
                    value={form.telefone}
                    onChange={(e) => {
                      const masked = formatPhoneBR(e.target.value)
                      setField('telefone', masked)
                      setBaseAntigaFields((prev) => ({ ...prev, telefone: false }))
                    }}
                    placeholder="(00) 0000-0000"
                    maxLength={15}
                  />
                </div>
                <div>
                  <Label>Telefone 2</Label>
                  <Input
                    value={form.telefone_2}
                    onChange={(e) => setField('telefone_2', formatPhoneBR(e.target.value))}
                    placeholder="(00) 0000-0000"
                    maxLength={15}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Telefone 3</Label>
                  <Input
                    value={form.telefone_3}
                    onChange={(e) => setField('telefone_3', formatPhoneBR(e.target.value))}
                    placeholder="(00) 0000-0000"
                    maxLength={15}
                  />
                </div>
                <div>
                  <Label>Celular</Label>
                  <Input
                    value={form.celular}
                    onChange={(e) => setField('celular', formatPhoneBR(e.target.value))}
                    placeholder="(00) 90000-0000"
                    maxLength={15}
                  />
                </div>
              </div>{' '}
              <div>
                <div className="flex items-center justify-between">
                  <Label>E-mail</Label>
                  {baseAntigaFields.email && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      <Database className="w-2.5 h-2.5" /> Base Bener
                    </span>
                  )}
                </div>
                <Input
                  value={form.email}
                  onChange={(e) => {
                    setField('email', e.target.value)
                    setBaseAntigaFields((prev) => ({ ...prev, email: false }))
                  }}
                />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>
              <div>
                <Label>E-mail Fiscal</Label>
                <Input
                  value={form.email_fiscal}
                  onChange={(e) => setField('email_fiscal', e.target.value)}
                />
                {errors.email_fiscal && (
                  <p className="text-xs text-destructive mt-1">{errors.email_fiscal}</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="endereco" className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1">
                      CEP
                      {cepLoading && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground font-normal">
                          <Loader2 className="w-3 h-3 inline animate-spin" /> Buscando CEP...
                        </span>
                      )}
                    </Label>
                    {(cepSource === 'base_antiga' || baseAntigaFields.cep) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-1.5 py-0.5 rounded cursor-help">
                              <Database className="w-2.5 h-2.5" /> Base Bener
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">Endereço carregado da base antiga de clientes</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <Input
                    value={form.cep}
                    onChange={(e) => {
                      const masked = formatCEP(e.target.value)
                      setField('cep', masked)
                      setCepError('')
                      setBaseAntigaFields((prev) => ({ ...prev, cep: false }))
                    }}
                    onBlur={(e) => handleCepBlur(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  {cepError && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {cepError}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Logradouro</Label>
                    {baseAntigaFields.logradouro && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        <Database className="w-2.5 h-2.5" /> Base Bener
                      </span>
                    )}
                  </div>
                  <Input
                    value={form.logradouro}
                    onChange={(e) => {
                      setField('logradouro', e.target.value)
                      setBaseAntigaFields((prev) => ({ ...prev, logradouro: false }))
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Número</Label>
                  <Input value={form.numero} onChange={(e) => setField('numero', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Complementos</Label>
                  <Input
                    value={form.complementos}
                    onChange={(e) => setField('complementos', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Bairro</Label>
                  <Input value={form.bairro} onChange={(e) => setField('bairro', e.target.value)} />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Cidade</Label>
                    {baseAntigaFields.cidade && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        <Database className="w-2.5 h-2.5" /> Base Bener
                      </span>
                    )}
                  </div>
                  <Input
                    value={form.cidade}
                    onChange={(e) => {
                      setField('cidade', e.target.value)
                      setBaseAntigaFields((prev) => ({ ...prev, cidade: false }))
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Estado (UF)</Label>
                  {baseAntigaFields.estado && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      <Database className="w-2.5 h-2.5" /> Base Bener
                    </span>
                  )}
                </div>
                <Input
                  value={form.estado}
                  onChange={(e) => {
                    setField('estado', e.target.value)
                    setBaseAntigaFields((prev) => ({ ...prev, estado: false }))
                  }}
                  maxLength={2}
                />
              </div>
            </TabsContent>

            <TabsContent value="contatos_multiplos" className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <div>
                  <Label className="text-sm font-semibold">Contatos da Empresa</Label>
                  <p className="text-xs text-muted-foreground">
                    Cadastre múltiplos contatos (comercial, compras, diretoria, técnico). Apenas um
                    deve ser o principal.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addContatoItem}
                  className="gap-1 bg-white hover:bg-slate-50 border-slate-300"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Contato
                </Button>
              </div>

              {loadingContatos && (
                <div className="p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" /> Carregando contatos...
                </div>
              )}

              {!loadingContatos && contatosList.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground border border-dashed rounded-md p-6 bg-slate-50/50">
                  <AlertCircle className="w-5 h-5 text-muted-foreground" />
                  <p>Nenhum contato cadastrado ainda.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addContatoItem}
                    className="mt-1 gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Primeiro Contato
                  </Button>
                </div>
              )}

              {!loadingContatos &&
                contatosList.map((c, index) => (
                  <div
                    key={c.id || index}
                    className={`border rounded-md p-3.5 space-y-2.5 transition-all ${
                      c.is_principal
                        ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50/30 dark:bg-slate-900/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          #{index + 1}
                        </span>
                        {c.is_principal ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded">
                            <UserCheck className="w-3 h-3 text-emerald-700" /> Contato Principal
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] text-muted-foreground hover:text-emerald-700 hover:bg-emerald-50 px-2 gap-1"
                            onClick={() => setContatoPrincipal(c.id)}
                          >
                            <Star className="w-3 h-3" /> Tornar Principal
                          </Button>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-red-50"
                        onClick={() => removeContatoItem(c.id)}
                        title="Excluir este contato"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <Label className="text-xs font-medium">Nome do Contato *</Label>
                        <Input
                          value={c.nome || ''}
                          onChange={(e) => updateContatoItem(c.id, 'nome', e.target.value)}
                          placeholder="Ex: Carlos Eduardo"
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium">Cargo / Função</Label>
                        <Input
                          value={c.cargo || ''}
                          onChange={(e) => updateContatoItem(c.id, 'cargo', e.target.value)}
                          placeholder="Ex: Diretor Industrial, Compras..."
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <Label className="text-xs font-medium">Telefone / Celular</Label>
                        <Input
                          value={c.telefone || ''}
                          onChange={(e) =>
                            updateContatoItem(c.id, 'telefone', formatPhoneBR(e.target.value))
                          }
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium">E-mail</Label>
                        <Input
                          value={c.email || ''}
                          onChange={(e) => updateContatoItem(c.id, 'email', e.target.value)}
                          placeholder="contato@empresa.com.br"
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editing ? 'Atualizar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
