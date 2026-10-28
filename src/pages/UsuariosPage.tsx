import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  fetchUsers,
  inviteUser,
  updateUserProfile,
  deleteUser,
  fetchGerentesParaSelect,
  fetchUserCategoriaIds,
  syncUserCategorias,
  syncUserEstadosAtuacao,
  type AdminUser,
} from '@/services/users'
import { fetchCategoriasProdutos } from '@/services/categorias-produtos'
import { type CategoriaProduto } from '@/types/categoria-produto'
import {
  ROLE_OPTIONS,
  ALL_MENU_KEYS,
  fetchRoleOptions,
  fetchRoleTemplates,
  createRoleTemplate,
  updateRoleTemplate,
  deleteRoleTemplate,
  type RoleTemplate,
} from '@/services/role-templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import {
  isValidCPF,
  isValidCNPJ,
  formatCpfCnpj,
  formatPhoneBR,
  isValidCpfOrCnpj,
  isValidCelularBR,
} from '@/lib/cpf-cnpj'
import { ESTADOS_BR } from '@/lib/tax-rates'
import {
  UserPlus,
  MoreVertical,
  Eye,
  EyeOff,
  Trash2,
  Shield,
  Pencil,
  ShieldAlert,
  Search,
  LayoutList,
  Layers,
  UserCheck,
  UserX,
} from 'lucide-react'
import { toast } from 'sonner'

/** Agrupa as chaves de menu por categoria para o checklist de permissões. */
const MENU_CATEGORIES: { label: string; keys: string[] }[] = [
  {
    label: 'Dashboard & Eventos',
    keys: ['dashboard', 'eventos'],
  },
  {
    label: 'Cadastros',
    keys: [
      'cadastros-clientes',
      'cadastros-representantes',
      'cadastros-regioes',
      'cadastros-gerentes',
      'cadastros-prepostos',
    ],
  },
  {
    label: 'Projetos',
    keys: ['projetos'],
  },
  {
    label: 'Controle de Propostas',
    keys: [
      'propostas-dashboard',
      'propostas-emitir',
      'propostas-criadas',
      'propostas-avancadas',
      'propostas-tipos',
    ],
  },
  {
    label: 'Produtos',
    keys: [
      'produtos-lista',
      'produtos-dashboard',
      'produtos-precos',
      'produtos-categorias',
      'produtos-marcas',
      'produtos-modelos',
      'produtos-versoes',
      'produtos-acessorios',
    ],
  },
  {
    label: 'Administração',
    keys: [
      'notificacoes',
      'importacoes',
      'area-atuacao',
      'usuarios',
      'auditoria',
      'configuracoes',
      'perfil',
    ],
  },
]

export default function UsuariosPage() {
  const { user: currentUser, refreshProfile } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    setor: '',
    role: 'Vendedor',
    gerente_id: '',
    estado_atuacao: '',
    celular: '',
    telefone: '',
    documento: '',
    password: '',
    confirmPassword: '',
  })
  const [createEstados, setCreateEstados] = useState<string[]>([])
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [editForm, setEditForm] = useState({
    role: '',
    setor: '',
    status: 'Ativo',
    gerente_id: '',
    estado_atuacao: '',
    celular: '',
    telefone: '',
    documento: '',
  })
  const [editEstados, setEditEstados] = useState<string[]>([])
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState(false)
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [showCreateConfirm, setShowCreateConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [roleOptions, setRoleOptions] = useState<string[]>(ROLE_OPTIONS)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('Todos')
  const [gerenteFilter, setGerenteFilter] = useState<string>('Todos')
  const [viewMode, setViewMode] = useState<'lista' | 'agrupado'>('lista')
  const [gerentes, setGerentes] = useState<{ id: string; nome: string }[]>([])
  const [categoriasList, setCategoriasList] = useState<CategoriaProduto[]>([])
  const [createCategoriaIds, setCreateCategoriaIds] = useState<string[]>([])
  const [editCategoriaIds, setEditCategoriaIds] = useState<string[]>([])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await fetchUsers()
    if (error) setError(error)
    else setUsers(data || [])
    setLoading(false)
  }, [])

  const refreshRoleOptions = useCallback(async () => {
    const opts = await fetchRoleOptions()
    setRoleOptions(opts)
  }, [])

  useEffect(() => {
    loadUsers()
    refreshRoleOptions()
    fetchGerentesParaSelect().then(setGerentes)
    fetchCategoriasProdutos().then((cats) => {
      setCategoriasList((cats || []).filter((c) => c.status === 'Ativo' && !c.deleted_at))
    })
  }, [loadUsers, refreshRoleOptions])

  const validateCreateForm = () => {
    const errors: Record<string, string> = {}
    if (!createForm.password) {
      errors.password = 'Senha é obrigatória.'
    } else if (createForm.password.length < 8) {
      errors.password = 'A senha deve ter no mínimo 8 caracteres.'
    }
    if (!createForm.confirmPassword) {
      errors.confirmPassword = 'Confirmação de senha é obrigatória.'
    } else if (createForm.confirmPassword !== createForm.password) {
      errors.confirmPassword = 'As senhas não coincidem.'
    }

    // Celular / WhatsApp opcional (valida só quando preenchido)
    const celDigits = (createForm.celular || '').replace(/\D/g, '')
    if (celDigits && !isValidCelularBR(createForm.celular)) {
      errors.celular = 'Informe um celular válido com DDD.'
    }

    // CPF / CNPJ opcional (valida só quando preenchido)
    const docDigits = (createForm.documento || '').replace(/\D/g, '')
    if (docDigits && !isValidCpfOrCnpj(createForm.documento)) {
      errors.documento = 'Informe um CPF ou CNPJ válido.'
    }

    setCreateErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateEditForm = () => {
    const errors: Record<string, string> = {}

    // Celular / WhatsApp opcional (valida só quando preenchido)
    const celDigits = (editForm.celular || '').replace(/\D/g, '')
    if (celDigits && !isValidCelularBR(editForm.celular)) {
      errors.celular = 'Informe um celular válido com DDD.'
    }

    // CPF / CNPJ opcional (valida só quando preenchido)
    const docDigits = (editForm.documento || '').replace(/\D/g, '')
    if (docDigits && !isValidCpfOrCnpj(editForm.documento)) {
      errors.documento = 'Informe um CPF ou CNPJ válido.'
    }

    setEditErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateCreateForm()) return
    setCreating(true)
    const { password, confirmPassword, ...rest } = createForm
    void confirmPassword
    const isCommercialRole = ['Vendedor', 'Representante'].includes(rest.role)
    const finalEstadosStr =
      isCommercialRole && createEstados.length > 0 ? createEstados.join(', ') : null

    const { error } = await inviteUser({
      ...rest,
      gerente_id: isCommercialRole && rest.gerente_id ? rest.gerente_id : null,
      estado_atuacao: finalEstadosStr,
      celular: rest.celular?.trim() || null,
      telefone: rest.telefone?.trim() || null,
      documento: rest.documento?.trim() || null,
      password,
    })
    if (error) {
      toast.error(`Erro: ${error}`)
    } else {
      // Sincronização complementar de categorias e estados no banco direto se for comercial
      if (isCommercialRole) {
        try {
          const { data: updatedUsers } = await fetchUsers()
          const createdUser = (updatedUsers || []).find(
            (u) => u.email.toLowerCase() === rest.email.toLowerCase(),
          )
          if (createdUser) {
            if (createCategoriaIds.length > 0) {
              await syncUserCategorias(
                createdUser.id,
                createdUser.email,
                createdUser.name,
                createCategoriaIds,
              )
            }
            if (createEstados.length > 0) {
              await syncUserEstadosAtuacao(
                createdUser.id,
                createdUser.email,
                createdUser.name,
                createEstados,
              )
            }
          }
        } catch (syncErr) {
          console.error('Erro na sincronização complementar do novo usuário:', syncErr)
        }
      }

      toast.success('Usuário criado com sucesso!')
      setCreateOpen(false)
      setCreateCategoriaIds([])
      setCreateEstados([])
      setCreateForm({
        name: '',
        email: '',
        setor: '',
        role: 'Vendedor',
        gerente_id: '',
        estado_atuacao: '',
        celular: '',
        telefone: '',
        documento: '',
        password: '',
        confirmPassword: '',
      })
      setCreateErrors({})
      loadUsers()
    }
    setCreating(false)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return
    if (!validateEditForm()) return
    setEditing(true)
    const isCommercialRole = ['Vendedor', 'Representante'].includes(editForm.role)
    const canSyncCategorias = ['Vendedor', 'Representante', 'Gerente'].includes(editForm.role)
    const finalEstadosStr =
      isCommercialRole && editEstados.length > 0 ? editEstados.join(', ') : null

    const { error } = await updateUserProfile(editUser.id, {
      ...editForm,
      gerente_id: isCommercialRole && editForm.gerente_id ? editForm.gerente_id : null,
      estado_atuacao: finalEstadosStr,
      celular: editForm.celular?.trim() || null,
      telefone: editForm.telefone?.trim() || null,
      documento: editForm.documento?.trim() || null,
    })
    if (error) {
      toast.error(`Erro: ${error}`)
    } else {
      // Sincroniza categorias se for vendedor, representante ou gerente
      if (canSyncCategorias) {
        try {
          await syncUserCategorias(editUser.id, editUser.email, editUser.name, editCategoriaIds)
        } catch (syncErr) {
          console.error('Erro ao sincronizar categorias do usuário:', syncErr)
          toast.error('Perfil atualizado, mas ocorreu um erro ao salvar categorias.')
        }
      }

      // Sincroniza estados em representante_regioes
      if (isCommercialRole) {
        try {
          await syncUserEstadosAtuacao(editUser.id, editUser.email, editUser.name, editEstados)
        } catch (syncErr) {
          console.error('Erro ao sincronizar estados do usuário:', syncErr)
        }
      }

      toast.success('Usuário atualizado!')
      if (currentUser?.id === editUser.id) {
        await refreshProfile()
      }
      setEditUser(null)
      setEditCategoriaIds([])
      setEditEstados([])
      setEditErrors({})
      loadUsers()
    }
    setEditing(false)
  }

  const handleToggleStatus = async (u: AdminUser) => {
    const newStatus = u.status === 'Ativo' ? 'Inativo' : 'Ativo'
    const { error } = await updateUserProfile(u.id, { status: newStatus })
    if (error) toast.error(`Erro: ${error}`)
    else {
      toast.success(`Usuário ${newStatus === 'Ativo' ? 'ativado' : 'desativado'}!`)
      loadUsers()
    }
  }

  const parseEstadosString = (str?: string | null): string[] => {
    if (!str) return []
    return Array.from(
      new Set(
        str
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter((s) => s.length > 0),
      ),
    )
  }

  const openEdit = async (u: AdminUser) => {
    setEditUser(u)
    setEditErrors({})
    setEditEstados(parseEstadosString(u.estado_atuacao))
    setEditForm({
      role: u.role,
      setor: u.setor,
      status: u.status,
      gerente_id: u.gerente_id || '',
      estado_atuacao: u.estado_atuacao || '',
      celular: u.celular ? formatPhoneBR(u.celular) : '',
      telefone: u.telefone || '',
      documento: u.documento ? formatCpfCnpj(u.documento) : '',
    })

    // Carrega categorias vinculadas se for Vendedor, Representante ou Gerente
    if (['Vendedor', 'Representante', 'Gerente'].includes(u.role)) {
      setEditCategoriaIds([])
      const { categoriaIds } = await fetchUserCategoriaIds(u.id, u.email)
      setEditCategoriaIds(categoriaIds)
    } else {
      setEditCategoriaIds([])
    }
  }

  // Lista dinâmica de opções de papel: combina roleOptions com qualquer role já existente nos usuários carregados
  const availableRoles = useMemo(() => {
    const set = new Set<string>(roleOptions)
    users.forEach((u) => {
      if (u.role) set.add(u.role)
    })
    return Array.from(set)
  }, [roleOptions, users])

  // Mapa de id do gerente -> nome do gerente (para fallback e exibição rápida)
  const gerenteMap = useMemo(() => {
    const map = new Map<string, string>()
    gerentes.forEach((g) => {
      map.set(g.id, g.nome)
    })
    return map
  }, [gerentes])

  // Filtro combinado de busca (nome / email / setor), papel (role) e gerente
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      const matchesRole = roleFilter === 'Todos' || u.role === roleFilter
      const matchesSearch =
        !q ||
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.setor || '').toLowerCase().includes(q)

      let matchesGerente = true
      if (gerenteFilter === 'Todos') {
        matchesGerente = true
      } else if (gerenteFilter === 'sem_gerente') {
        matchesGerente = !u.gerente_id
      } else {
        matchesGerente = u.gerente_id === gerenteFilter
      }

      return matchesRole && matchesSearch && matchesGerente
    })
  }, [users, roleFilter, search, gerenteFilter])

  // Agrupamento de usuários por gerente para a visualização "agrupado"
  const groupedUsers = useMemo(() => {
    const groups: {
      key: string
      gerenteId: string | null
      gerenteNome: string
      isSemGerente: boolean
      users: AdminUser[]
    }[] = []

    const map = new Map<string, AdminUser[]>()
    const semGerenteList: AdminUser[] = []

    filteredUsers.forEach((u) => {
      if (!u.gerente_id) {
        semGerenteList.push(u)
      } else {
        const list = map.get(u.gerente_id) || []
        list.push(u)
        map.set(u.gerente_id, list)
      }
    })

    // Adiciona grupos de gerentes cadastrados que possuem usuários (ou gerentes que combinam)
    // Ordena gerentes por nome
    const sortedGerenteIds = Array.from(map.keys()).sort((a, b) => {
      const nameA = gerenteMap.get(a) || ''
      const nameB = gerenteMap.get(b) || ''
      return nameA.localeCompare(nameB, 'pt-BR')
    })

    sortedGerenteIds.forEach((gId) => {
      const uList = map.get(gId) || []
      const resolvedNome =
        gerenteMap.get(gId) || uList.find((u) => u.gerente_nome)?.gerente_nome || 'Gerente'
      groups.push({
        key: gId,
        gerenteId: gId,
        gerenteNome: resolvedNome,
        isSemGerente: false,
        users: uList,
      })
    })

    // Adiciona grupo "Sem gerente" se houver usuários sem gerente vinculado
    if (semGerenteList.length > 0) {
      groups.push({
        key: 'sem_gerente',
        gerenteId: null,
        gerenteNome: 'Sem gerente',
        isSemGerente: true,
        users: semGerenteList,
      })
    }

    return groups
  }, [filteredUsers, gerenteMap])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await deleteUser(deleteTarget.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Usuário excluído com sucesso.')
      setDeleteTarget(null)
      loadUsers()
    }
    setDeleting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie usuários, perfis e permissões do sistema
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open)
            if (open) {
              setCreateForm({
                name: '',
                email: '',
                setor: '',
                role: 'Vendedor',
                gerente_id: '',
                estado_atuacao: '',
                celular: '',
                telefone: '',
                documento: '',
                password: '',
                confirmPassword: '',
              })
              setCreateErrors({})
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 gap-2">
              <UserPlus className="w-4 h-4" /> Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar Novo Usuário</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Setor</Label>
                <Input
                  value={createForm.setor}
                  onChange={(e) => setCreateForm({ ...createForm, setor: e.target.value })}
                />
              </div>
              <div>
                <Label>Perfil</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(v) => {
                    const isEligible = ['Vendedor', 'Representante'].includes(v)
                    setCreateForm({
                      ...createForm,
                      role: v,
                      gerente_id: isEligible ? createForm.gerente_id : '',
                      estado_atuacao: isEligible ? createForm.estado_atuacao : '',
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {['Vendedor', 'Representante'].includes(createForm.role) && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>Gerente Responsável</Label>
                    {createForm.gerente_id && (
                      <button
                        type="button"
                        onClick={() => setCreateForm({ ...createForm, gerente_id: '' })}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <Select
                    value={createForm.gerente_id || 'none'}
                    onValueChange={(v) =>
                      setCreateForm({ ...createForm, gerente_id: v === 'none' ? '' : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar gerente..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum gerente</SelectItem>
                      {gerentes.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {['Vendedor', 'Representante'].includes(createForm.role) && (
                <div className="rounded-lg border p-3 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-xs text-foreground">
                      Categorias Autorizadas (Catálogo)
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      {createCategoriaIds.length} selecionada(s)
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    O vendedor só visualizará máquinas e emitirá propostas das categorias marcadas
                    abaixo.
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1 max-h-36 overflow-y-auto">
                    {categoriasList.map((cat) => {
                      const isChecked = createCategoriaIds.includes(cat.id)
                      return (
                        <label
                          key={cat.id}
                          className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent/50 cursor-pointer text-xs"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setCreateCategoriaIds((prev) => [...prev, cat.id])
                              } else {
                                setCreateCategoriaIds((prev) => prev.filter((id) => id !== cat.id))
                              }
                            }}
                          />
                          <span className="truncate">{cat.nome}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              {['Vendedor', 'Representante'].includes(createForm.role) && (
                <div className="rounded-lg border p-3 bg-muted/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-semibold text-xs text-foreground">
                        Estados de Atuação
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Selecione um ou mais estados onde este vendedor atua
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCreateEstados(ESTADOS_BR.map((e) => e.uf))}
                        className="text-xs font-medium text-primary hover:underline cursor-pointer"
                      >
                        Marcar todos
                      </button>
                      <span className="text-muted-foreground text-xs">•</span>
                      <button
                        type="button"
                        onClick={() => setCreateEstados([])}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-1.5 pt-1">
                    {ESTADOS_BR.map((item) => {
                      const isChecked = createEstados.includes(item.uf)
                      return (
                        <label
                          key={item.uf}
                          title={`${item.uf} - ${item.nome}`}
                          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md border text-xs font-semibold cursor-pointer transition-colors select-none ${
                            isChecked
                              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                              : 'bg-background hover:bg-accent text-foreground border-input'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCreateEstados((prev) => [...prev, item.uf])
                              } else {
                                setCreateEstados((prev) => prev.filter((uf) => uf !== item.uf))
                              }
                            }}
                            className="w-3.5 h-3.5 accent-primary cursor-pointer rounded"
                          />
                          <span>{item.uf}</span>
                        </label>
                      )
                    })}
                  </div>

                  {createEstados.length > 0 && (
                    <div className="text-[11px] text-muted-foreground bg-background/80 p-2 rounded border">
                      <strong>Selecionados ({createEstados.length}):</strong>{' '}
                      <span className="font-mono text-foreground font-medium">
                        {createEstados.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Celular / WhatsApp</Label>
                  <Input
                    placeholder="(11) 98765-4321"
                    value={createForm.celular}
                    onChange={(e) => {
                      const masked = formatPhoneBR(e.target.value)
                      setCreateForm({ ...createForm, celular: masked })
                      if (createErrors.celular) setCreateErrors({ ...createErrors, celular: '' })
                    }}
                  />
                  {createErrors.celular && (
                    <p className="text-xs text-destructive mt-1">{createErrors.celular}</p>
                  )}
                </div>
                <div>
                  <Label>CPF / CNPJ</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={createForm.documento}
                    onChange={(e) => {
                      const masked = formatCpfCnpj(e.target.value)
                      setCreateForm({ ...createForm, documento: masked })
                      if (createErrors.documento)
                        setCreateErrors({ ...createErrors, documento: '' })
                    }}
                  />
                  {createErrors.documento && (
                    <p className="text-xs text-destructive mt-1">{createErrors.documento}</p>
                  )}
                </div>
              </div>
              <div>
                <Label>Senha</Label>
                <div className="relative">
                  <Input
                    type={showCreatePassword ? 'text' : 'password'}
                    value={createForm.password}
                    onChange={(e) => {
                      setCreateForm({ ...createForm, password: e.target.value })
                      if (createErrors.password) setCreateErrors({ ...createErrors, password: '' })
                    }}
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCreatePassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {createErrors.password && (
                  <p className="text-xs text-destructive mt-1">{createErrors.password}</p>
                )}
              </div>
              <div>
                <Label>Confirmar Senha</Label>
                <div className="relative">
                  <Input
                    type={showCreateConfirm ? 'text' : 'password'}
                    value={createForm.confirmPassword}
                    onChange={(e) => {
                      setCreateForm({ ...createForm, confirmPassword: e.target.value })
                      if (createErrors.confirmPassword)
                        setCreateErrors({ ...createErrors, confirmPassword: '' })
                    }}
                    placeholder="Repita a senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreateConfirm(!showCreateConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCreateConfirm ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {createErrors.confirmPassword && (
                  <p className="text-xs text-destructive mt-1">{createErrors.confirmPassword}</p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={creating} className="bg-primary">
                  {creating ? 'Enviando...' : 'Convidar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="perfis">Perfis</TabsTrigger>
        </TabsList>

        {/* ------------------------ Aba Usuários ------------------------ */}
        <TabsContent value="usuarios" className="mt-4 space-y-4">
          {/* Barra de filtros: busca por nome/email, papel (role), filtro por gerente e toggle de visualização */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Buscar por nome ou e-mail..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  aria-label="Buscar usuários por nome ou e-mail"
                />
              </div>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por papel">
                  <SelectValue placeholder="Papel: Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos os papéis</SelectItem>
                  {availableRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro por gerente */}
              <Select value={gerenteFilter} onValueChange={setGerenteFilter}>
                <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por gerente">
                  <SelectValue placeholder="Gerente: Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos os gerentes</SelectItem>
                  <SelectItem value="sem_gerente">Sem gerente definido</SelectItem>
                  {gerentes.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(search || roleFilter !== 'Todos' || gerenteFilter !== 'Todos') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('')
                    setRoleFilter('Todos')
                    setGerenteFilter('Todos')
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground h-9 px-2"
                >
                  Limpar filtros
                </Button>
              )}
            </div>

            {/* Alternância de Modo de Visualização: Lista única ou Agrupado por Gerente */}
            <div className="inline-flex items-center rounded-lg border bg-muted/40 p-1 self-start sm:self-auto">
              <Button
                type="button"
                variant={viewMode === 'lista' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('lista')}
                className="h-8 px-3 text-xs gap-1.5 font-medium shadow-none"
                aria-pressed={viewMode === 'lista'}
                title="Exibir como lista única"
              >
                <LayoutList className="w-3.5 h-3.5" />
                Lista
              </Button>
              <Button
                type="button"
                variant={viewMode === 'agrupado' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('agrupado')}
                className="h-8 px-3 text-xs gap-1.5 font-medium shadow-none"
                aria-pressed={viewMode === 'agrupado'}
                title="Agrupar usuários por gerente"
              >
                <Layers className="w-3.5 h-3.5" />
                Agrupar por Gerente
              </Button>
            </div>
          </div>

          {loading ? (
            <LoadingState count={6} />
          ) : error ? (
            <ErrorState message={error} onRetry={loadUsers} />
          ) : users.length === 0 ? (
            <EmptyState
              title="Nenhum usuário encontrado"
              actionText="Criar Usuário"
              onAction={() => setCreateOpen(true)}
            />
          ) : filteredUsers.length === 0 ? (
            <div className="border rounded-lg bg-card p-8 text-center space-y-2">
              <p className="text-sm font-medium text-foreground">
                Nenhum usuário corresponde aos filtros selecionados.
              </p>
              <p className="text-xs text-muted-foreground">
                Tente ajustar a busca, o papel ou o gerente selecionado.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setRoleFilter('Todos')
                  setGerenteFilter('Todos')
                }}
                className="mt-2 text-xs"
              >
                Limpar filtros
              </Button>
            </div>
          ) : viewMode === 'agrupado' ? (
            /* Visualização agrupada por Gerente */
            <div className="space-y-6">
              {groupedUsers.map((group) => (
                <div
                  key={group.key}
                  className="border rounded-lg bg-card overflow-hidden shadow-xs"
                >
                  <div className="px-4 py-3 bg-muted/40 border-b flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {group.isSemGerente ? (
                        <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                          <UserX className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <UserCheck className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          {group.gerenteNome}
                          {group.isSemGerente && (
                            <span className="text-[11px] font-normal text-muted-foreground">
                              (sem vínculo com gerente)
                            </span>
                          )}
                        </h3>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs font-normal">
                      {group.users.length} {group.users.length === 1 ? 'usuário' : 'usuários'}
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Setor</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Data Criação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-semibold">
                            {u.name || '—'}
                            {u.id === currentUser?.id && (
                              <span className="text-xs text-muted-foreground ml-2">(Você)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{u.email}</TableCell>
                          <TableCell>
                            <Badge
                              variant={u.role === 'Admin Completo' ? 'default' : 'secondary'}
                              className={u.status === 'Inativo' ? 'opacity-50' : ''}
                            >
                              {u.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{u.setor || '—'}</TableCell>
                          <TableCell className="text-sm">
                            {u.estado_atuacao ? (
                              <Badge variant="outline" className="font-mono">
                                {u.estado_atuacao}
                              </Badge>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {new Date(u.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(u)}>
                                  Editar Perfil
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleStatus(u)}>
                                  {u.status === 'Ativo' ? 'Desativar' : 'Ativar'}
                                </DropdownMenuItem>
                                {u.id !== currentUser?.id && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => setDeleteTarget(u)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          ) : (
            /* Visualização Lista Única */
            <div className="border rounded-lg bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Gerente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Data Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold">
                        {u.name || '—'}
                        {u.id === currentUser?.id && (
                          <span className="text-xs text-muted-foreground ml-2">(Você)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={u.role === 'Admin Completo' ? 'default' : 'secondary'}
                          className={u.status === 'Inativo' ? 'opacity-50' : ''}
                        >
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{u.setor || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {u.gerente_nome ||
                          (u.gerente_id ? (gerenteMap.get(u.gerente_id) ?? '—') : '—')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.estado_atuacao ? (
                          <Badge variant="outline" className="font-mono">
                            {u.estado_atuacao}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {new Date(u.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(u)}>
                              Editar Perfil
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(u)}>
                              {u.status === 'Ativo' ? 'Desativar' : 'Ativar'}
                            </DropdownMenuItem>
                            {u.id !== currentUser?.id && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteTarget(u)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ------------------------ Aba Perfis ------------------------ */}
        <TabsContent value="perfis" className="mt-4">
          <PerfisTab onChanged={refreshRoleOptions} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <DialogTitle>Excluir Usuário</DialogTitle>
                <DialogDescription className="text-xs">
                  Esta ação não pode ser desfeita.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o usuário{' '}
            <strong className="text-foreground">{deleteTarget?.name || '—'}</strong> (
            {deleteTarget?.email})? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          {editUser && (
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={editUser.name} disabled />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={editUser.email} disabled />
              </div>
              <div>
                <Label>Setor</Label>
                <Input
                  value={editForm.setor}
                  onChange={(e) => setEditForm({ ...editForm, setor: e.target.value })}
                />
              </div>
              <div>
                <Label>Perfil</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(v) => {
                    const isCommercial = ['Vendedor', 'Representante'].includes(v)
                    const canHaveCats = ['Vendedor', 'Representante', 'Gerente'].includes(v)
                    setEditForm({
                      ...editForm,
                      role: v,
                      gerente_id: isCommercial ? editForm.gerente_id : '',
                      estado_atuacao: isCommercial ? editForm.estado_atuacao : '',
                    })
                    if (!canHaveCats) {
                      setEditCategoriaIds([])
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {['Vendedor', 'Representante'].includes(editForm.role) && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>Gerente Responsável</Label>
                    {editForm.gerente_id && (
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, gerente_id: '' })}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <Select
                    value={editForm.gerente_id || 'none'}
                    onValueChange={(v) =>
                      setEditForm({ ...editForm, gerente_id: v === 'none' ? '' : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar gerente..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum gerente</SelectItem>
                      {gerentes.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {['Vendedor', 'Representante', 'Gerente'].includes(editForm.role) && (
                <div className="rounded-lg border p-3 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-xs text-foreground">
                      Categorias Autorizadas (Catálogo)
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      {editCategoriaIds.length} selecionada(s)
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    O vendedor só visualizará máquinas e emitirá propostas das categorias marcadas
                    abaixo.
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1 max-h-36 overflow-y-auto">
                    {categoriasList.map((cat) => {
                      const isChecked = editCategoriaIds.includes(cat.id)
                      return (
                        <label
                          key={cat.id}
                          className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent/50 cursor-pointer text-xs"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setEditCategoriaIds((prev) => [...prev, cat.id])
                              } else {
                                setEditCategoriaIds((prev) => prev.filter((id) => id !== cat.id))
                              }
                            }}
                          />
                          <span className="truncate">{cat.nome}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              {['Vendedor', 'Representante'].includes(editForm.role) && (
                <div className="rounded-lg border p-3 bg-muted/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-semibold text-xs text-foreground">
                        Estados de Atuação
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Selecione um ou mais estados onde este vendedor atua
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditEstados(ESTADOS_BR.map((e) => e.uf))}
                        className="text-xs font-medium text-primary hover:underline cursor-pointer"
                      >
                        Marcar todos
                      </button>
                      <span className="text-muted-foreground text-xs">•</span>
                      <button
                        type="button"
                        onClick={() => setEditEstados([])}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-1.5 pt-1">
                    {ESTADOS_BR.map((item) => {
                      const isChecked = editEstados.includes(item.uf)
                      return (
                        <label
                          key={item.uf}
                          title={`${item.uf} - ${item.nome}`}
                          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md border text-xs font-semibold cursor-pointer transition-colors select-none ${
                            isChecked
                              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                              : 'bg-background hover:bg-accent text-foreground border-input'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditEstados((prev) => [...prev, item.uf])
                              } else {
                                setEditEstados((prev) => prev.filter((uf) => uf !== item.uf))
                              }
                            }}
                            className="w-3.5 h-3.5 accent-primary cursor-pointer rounded"
                          />
                          <span>{item.uf}</span>
                        </label>
                      )
                    })}
                  </div>

                  {editEstados.length > 0 && (
                    <div className="text-[11px] text-muted-foreground bg-background/80 p-2 rounded border">
                      <strong>Selecionados ({editEstados.length}):</strong>{' '}
                      <span className="font-mono text-foreground font-medium">
                        {editEstados.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Celular / WhatsApp</Label>
                  <Input
                    placeholder="(11) 98765-4321"
                    value={editForm.celular}
                    onChange={(e) => {
                      const masked = formatPhoneBR(e.target.value)
                      setEditForm({ ...editForm, celular: masked })
                      if (editErrors.celular) setEditErrors({ ...editErrors, celular: '' })
                    }}
                  />
                  {editErrors.celular && (
                    <p className="text-xs text-destructive mt-1">{editErrors.celular}</p>
                  )}
                </div>
                <div>
                  <Label>CPF / CNPJ</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={editForm.documento}
                    onChange={(e) => {
                      const masked = formatCpfCnpj(e.target.value)
                      setEditForm({ ...editForm, documento: masked })
                      if (editErrors.documento) setEditErrors({ ...editErrors, documento: '' })
                    }}
                  />
                  {editErrors.documento && (
                    <p className="text-xs text-destructive mt-1">{editErrors.documento}</p>
                  )}
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={editing} className="bg-primary">
                  {editing ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Aba "Perfis" — gestão de role_templates customizáveis
// ============================================================

function PerfisTab({ onChanged }: { onChanged: () => void }) {
  const [templates, setTemplates] = useState<RoleTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<RoleTemplate | null>(null)
  const [form, setForm] = useState<{ name: string; menu_access: string[] }>({
    name: '',
    menu_access: [],
  })
  const [saving, setSaving] = useState(false)
  const [deleteTpl, setDeleteTpl] = useState<RoleTemplate | null>(null)
  const [deletingTpl, setDeletingTpl] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchRoleTemplates()
      setTemplates(data)
    } catch {
      setError('Não foi possível carregar os perfis.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditingTemplate(null)
    setForm({ name: '', menu_access: [] })
    setDialogOpen(true)
  }

  const openEdit = (t: RoleTemplate) => {
    setEditingTemplate(t)
    setForm({ name: t.name, menu_access: [...t.menu_access] })
    setDialogOpen(true)
  }

  const toggleMenu = (key: string) =>
    setForm((p) => ({
      ...p,
      menu_access: p.menu_access.includes(key)
        ? p.menu_access.filter((k) => k !== key)
        : [...p.menu_access, key],
    }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Informe um nome para o perfil.')
      return
    }
    setSaving(true)
    if (editingTemplate) {
      const { error } = await updateRoleTemplate(editingTemplate.id, {
        name: form.name.trim(),
        menu_access: form.menu_access,
      })
      if (error) toast.error(`Erro: ${error}`)
      else {
        toast.success('Perfil atualizado!')
        setDialogOpen(false)
        load()
        onChanged()
      }
    } else {
      const { error } = await createRoleTemplate(form.name.trim(), form.menu_access)
      if (error) toast.error(`Erro: ${error}`)
      else {
        toast.success('Perfil criado com sucesso!')
        setDialogOpen(false)
        load()
        onChanged()
      }
    }
    setSaving(false)
  }

  const handleDeleteTpl = async () => {
    if (!deleteTpl) return
    setDeletingTpl(true)
    const { error } = await deleteRoleTemplate(deleteTpl.id)
    if (error) toast.error(`Erro: ${error}`)
    else {
      toast.success('Perfil excluído.')
      setDeleteTpl(null)
      load()
      onChanged()
    }
    setDeletingTpl(false)
  }

  if (loading) {
    return <LoadingState count={4} />
  }
  if (error) {
    return <ErrorState message={error} onRetry={load} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          Crie e gerencie perfis de acesso customizáveis. Perfis do sistema não podem ser excluídos.
        </p>
        <Button onClick={openCreate} className="gap-2" style={{ backgroundColor: '#0b3c26' }}>
          <Shield className="w-4 h-4" /> Novo Perfil
        </Button>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Acesso</TableHead>
              <TableHead>Sistema?</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum perfil encontrado.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-semibold">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.menu_access.length} menu(s)
                  </TableCell>
                  <TableCell>
                    {t.is_system ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Sistema
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Customizado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(t)}
                        aria-label="Editar perfil"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={t.is_system}
                                onClick={() => setDeleteTpl(t)}
                                className="text-destructive hover:text-destructive"
                                aria-label="Excluir perfil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {t.is_system && <TooltipContent>Perfil do sistema</TooltipContent>}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog criar/editar perfil */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Editar Perfil' : 'Novo Perfil'}</DialogTitle>
            <DialogDescription>
              Defina o nome e quais menus este perfil poderá acessar.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>Nome do Perfil</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Comercial, Técnico..."
                required
              />
            </div>
            <div>
              <Label>Permissões de Menu</Label>
              <ScrollArea className="h-[40vh] pr-3 border rounded-md p-3">
                <div className="space-y-4">
                  {MENU_CATEGORIES.map((cat) => (
                    <div key={cat.label} className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {cat.label}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {cat.keys.map((key) => (
                          <div
                            key={key}
                            className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent"
                          >
                            <Checkbox
                              checked={form.menu_access.includes(key)}
                              onCheckedChange={() => toggleMenu(key)}
                              id={`perm-${key}`}
                            />
                            <Label
                              htmlFor={`perm-${key}`}
                              className="text-xs cursor-pointer flex-1"
                            >
                              {key}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {/* Chaves órfãs (não categorizadas) por segurança */}
                  {ALL_MENU_KEYS.filter((k) => !MENU_CATEGORIES.some((c) => c.keys.includes(k)))
                    .length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Outros
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {ALL_MENU_KEYS.filter(
                          (k) => !MENU_CATEGORIES.some((c) => c.keys.includes(k)),
                        ).map((key) => (
                          <div
                            key={key}
                            className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent"
                          >
                            <Checkbox
                              checked={form.menu_access.includes(key)}
                              onCheckedChange={() => toggleMenu(key)}
                              id={`perm-${key}`}
                            />
                            <Label
                              htmlFor={`perm-${key}`}
                              className="text-xs cursor-pointer flex-1"
                            >
                              {key}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="bg-primary">
                {saving ? 'Salvando...' : editingTemplate ? 'Salvar' : 'Criar Perfil'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog excluir perfil */}
      <Dialog open={!!deleteTpl} onOpenChange={(open) => !open && setDeleteTpl(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <DialogTitle>Excluir Perfil</DialogTitle>
                <DialogDescription className="text-xs">
                  Esta ação não pode ser desfeita.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o perfil{' '}
            <strong className="text-foreground">{deleteTpl?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTpl(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteTpl} disabled={deletingTpl}>
              {deletingTpl ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
