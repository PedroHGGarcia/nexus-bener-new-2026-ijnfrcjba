import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchAuditLogs,
  AUDITED_TABLES,
  AuditLogEntry,
  AuditLogFilters,
} from '@/services/audit-logs'
import { fetchUsers, AdminUser } from '@/services/users'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import {
  Filter,
  Search,
  Clock,
  Users,
  Eye,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Activity,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { UserAuditSheet } from '@/components/shared/user-audit-sheet'
import { fetchActiveUsers, ActiveUserItem } from '@/services/activity-tracker'
import { ActiveUsersTab } from '@/components/auditoria/ActiveUsersTab'
import { isUserRecentlyActive } from '@/lib/friendly-date'
import {
  formatAuditAction,
  formatAuditTable,
  summarizeAuditChanges,
  getActionBadgeVariant,
} from '@/lib/audit-utils'

/** Presença recebida do canal realtime (compatível com o hook usePresence). */
interface PresenceUser {
  userId: string
  name: string
  email: string
  role?: string
  avatarUrl?: string
  path: string
  label: string
  ts: number
}

const ONLINE_WINDOW_MS = 15 * 60 * 1000 // 15 minutos

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function timeAgo(iso: string | null) {
  if (!iso) return 'nunca'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'agora'
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

function getInitials(name: string) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [filters, setFilters] = useState<Omit<AuditLogFilters, 'page' | 'pageSize'>>({})
  const [appliedFilters, setAppliedFilters] = useState<Omit<AuditLogFilters, 'page' | 'pageSize'>>(
    {},
  )

  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string>(new Date().toISOString())

  // Usuários Ativos (rastreio de atividade geral: qualquer ação / heartbeat)
  const [activeUsers, setActiveUsers] = useState<ActiveUserItem[]>([])
  const [activeLoading, setActiveLoading] = useState(true)
  const [activeError, setActiveError] = useState<string | null>(null)

  // Sheet de atividade por usuário (aba Usuários Online)
  const [activityUser, setActivityUser] = useState<string | null>(null)
  const [activityOpen, setActivityOpen] = useState(false)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    const {
      data,
      error,
      hasMore: more,
    } = await fetchAuditLogs({
      ...appliedFilters,
      page,
      pageSize: 50,
    })
    if (error) {
      setError(error)
    } else {
      setLogs(data || [])
      setHasMore(more)
    }
    setLoading(false)
  }, [appliedFilters, page])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    setUsersError(null)
    const { data, error } = await fetchUsers()
    if (error) setUsersError(error)
    else setUsers(data || [])
    setUsersLoading(false)
    setLastUpdate(new Date().toISOString())
  }, [])

  const loadActiveUsers = useCallback(async () => {
    setActiveLoading(true)
    setActiveError(null)
    const { data, error } = await fetchActiveUsers()
    if (error) setActiveError(error)
    else setActiveUsers(data || [])
    setActiveLoading(false)
  }, [])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  useEffect(() => {
    loadUsers()
    loadActiveUsers()
    // Atualiza a lista de logins/online e usuários ativos a cada 60s
    const interval = setInterval(() => {
      loadUsers()
      loadActiveUsers()
    }, 60000)
    return () => clearInterval(interval)
  }, [loadUsers, loadActiveUsers])

  // --- Presença em tempo real (rota/página atual de cada usuário online) ---
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    // Canal distinto do hook usePresence (que usa 'presence-online-users')
    // para evitar conflitos de instância/deduplicação. A presença ainda é
    // compartilhada entre clientes no mesmo grupo de canal via Realtime.
    const channel = supabase.channel('auditoria:presence-online-users')

    // IMPORTANTE: registrar TODOS os callbacks ANTES de chamar subscribe().
    // O cliente Realtime não permite adicionar callbacks após subscribe().
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceUser>()
      // presenceState agrupa por chave; cada chave pode ter múltiplos registros
      // (uma por aba). Usamos o mais recente por usuário (maior ts).
      const byUser = new Map<string, PresenceUser>()
      Object.values(state).forEach((entries) => {
        entries.forEach((entry) => {
          const key = entry.userId || entry.email
          const prev = byUser.get(key)
          if (!prev || entry.ts > prev.ts) {
            byUser.set(key, entry)
          }
        })
      })
      setPresenceUsers(Array.from(byUser.values()).sort((a, b) => b.ts - a.ts))
    })

    presenceChannelRef.current = channel

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (presenceChannelRef.current === channel) {
        presenceChannelRef.current = null
      }
    }
  }, [])

  // Usuários ordenados do último login mais recente ao mais antigo
  const sortedByLogin = [...users].sort((a, b) => {
    const ta = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0
    const tb = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0
    return tb - ta
  })

  const now = Date.now()
  const onlineUsers = sortedByLogin.filter(
    (u) => u.last_sign_in_at && now - new Date(u.last_sign_in_at).getTime() <= ONLINE_WINDOW_MS,
  )
  const activeNowCount = activeUsers.filter((u) => isUserRecentlyActive(u.last_seen_at, 15)).length

  // Índice de presença por e-mail (lowercase) e por id, para enriquecer a
  // lista de usuários online com a rota atual de cada um.
  const presenceByEmail = new Map<string, PresenceUser>()
  const presenceById = new Map<string, PresenceUser>()
  presenceUsers.forEach((p) => {
    if (p.email) presenceByEmail.set(p.email.toLowerCase(), p)
    if (p.userId) presenceById.set(p.userId, p)
  })

  const hasPresence = presenceUsers.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Trilha de Auditoria</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registro automático de todas as operações do sistema
        </p>
      </div>

      <Tabs defaultValue="logs" className="w-full">
        <TabsList>
          <TabsTrigger value="logs" className="gap-2">
            <Filter className="w-4 h-4" /> Logs
          </TabsTrigger>
          <TabsTrigger value="ativos" className="gap-2">
            <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Usuários Ativos
            {activeNowCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 px-1.5 text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
              >
                {activeNowCount} online
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logins" className="gap-2">
            <Clock className="w-4 h-4" /> Últimos Logins
          </TabsTrigger>
          <TabsTrigger value="online" className="gap-2">
            <Users className="w-4 h-4" /> Usuários Online (Sessão)
            {onlineUsers.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {onlineUsers.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Nova Aba: Usuários Ativos (qualquer atividade / sessão persistente) */}
        <TabsContent value="ativos" className="space-y-4 mt-6">
          <ActiveUsersTab
            users={activeUsers}
            loading={activeLoading}
            error={activeError}
            onRefresh={loadActiveUsers}
            onSelectUserActivity={(userName) => {
              setActivityUser(userName)
              setActivityOpen(true)
            }}
          />
        </TabsContent>

        {/* Aba Logs (conteúdo original) */}
        <TabsContent value="logs" className="space-y-6 mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <Label className="text-xs">Tabela</Label>
                  <Select
                    value={filters.tableName || 'all'}
                    onValueChange={(v) =>
                      setFilters({ ...filters, tableName: v === 'all' ? undefined : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {AUDITED_TABLES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Usuário</Label>
                  <Input
                    placeholder="Buscar por usuário"
                    value={filters.userName || ''}
                    onChange={(e) => setFilters({ ...filters, userName: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Data Início</Label>
                  <Input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Data Fim</Label>
                  <Input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={() => {
                    setPage(1)
                    setAppliedFilters({ ...filters })
                  }}
                  className="bg-primary gap-2"
                  size="sm"
                >
                  <Search className="w-4 h-4" /> Aplicar Filtros
                </Button>
                <Button
                  onClick={() => {
                    setFilters({})
                    setAppliedFilters({})
                    setPage(1)
                  }}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Filter className="w-4 h-4" /> Limpar
                </Button>
                <Button
                  onClick={loadLogs}
                  variant="ghost"
                  size="sm"
                  className="gap-2 ml-auto"
                  disabled={loading}
                  title="Recarregar logs"
                >
                  <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <LoadingState count={8} />
          ) : error ? (
            <ErrorState message={error} onRetry={loadLogs} />
          ) : logs.length === 0 ? (
            <EmptyState
              title="Nenhum log encontrado"
              description="Não há registros de auditoria com os filtros selecionados."
            />
          ) : (
            <div className="space-y-3">
              <div className="border rounded-lg bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação</TableHead>
                      <TableHead>Tabela</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Alterações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const badgeInfo = getActionBadgeVariant(log.action)
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge className={`text-[10px] uppercase ${badgeInfo.className}`}>
                              {formatAuditAction(log.action)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {formatAuditTable(log.table_name)}
                          </TableCell>
                          <TableCell className="text-sm">{log.user_name || '—'}</TableCell>
                          <TableCell className="text-xs font-mono">
                            {log.record_id ? log.record_id.slice(0, 8) + '…' : '—'}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell
                            className="text-xs text-muted-foreground max-w-xs truncate"
                            title={summarizeAuditChanges(log)}
                          >
                            {summarizeAuditChanges(log)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Controles de Paginação Server-side */}
              <div className="flex items-center justify-between px-1 py-2">
                <p className="text-xs text-muted-foreground">
                  Página <span className="font-semibold text-foreground">{page}</span>
                  {logs.length > 0 && ` (exibindo ${logs.length} registros)`}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 h-8 text-xs"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 h-8 text-xs"
                    disabled={!hasMore || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Aba Últimos Logins */}
        <TabsContent value="logins" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {usersLoading
                ? 'Carregando...'
                : `${sortedByLogin.length} usuário(s) — ordenado pelo último login`}
            </p>
            <Button variant="outline" size="sm" onClick={loadUsers} disabled={usersLoading}>
              Atualizar
            </Button>
          </div>

          {usersLoading ? (
            <LoadingState count={6} />
          ) : usersError ? (
            <ErrorState message={usersError} onRetry={loadUsers} />
          ) : sortedByLogin.length === 0 ? (
            <EmptyState
              title="Nenhum usuário encontrado"
              description="Não há usuários cadastrados no sistema."
            />
          ) : (
            <div className="border rounded-lg bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedByLogin.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={u.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(u.name || u.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{u.name || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.role || '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.status === 'Ativo' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {u.status || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        <div className="flex flex-col gap-0.5">
                          <span>{formatDateTime(u.last_sign_in_at)}</span>
                          <span className="text-muted-foreground">
                            {u.last_sign_in_at ? timeAgo(u.last_sign_in_at) : 'nunca acessou'}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Aba Usuários Online */}
        <TabsContent value="online" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-background opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-background" />
                </span>
                {onlineUsers.length} online
              </Badge>
              <p className="text-sm text-muted-foreground">
                Considera logins nos últimos 15 minutos · atualizado {timeAgo(lastUpdate)}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadUsers} disabled={usersLoading}>
              Atualizar
            </Button>
          </div>

          {usersLoading ? (
            <LoadingState count={4} />
          ) : usersError ? (
            <ErrorState message={usersError} onRetry={loadUsers} />
          ) : onlineUsers.length === 0 ? (
            <EmptyState
              title="Nenhum usuário online"
              description="Não há usuários com login nos últimos 15 minutos."
            />
          ) : (
            <div className="border rounded-lg bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    {hasPresence && <TableHead>Página Atual</TableHead>}
                    <TableHead>Último Login</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onlineUsers.map((u) => {
                    const presence =
                      presenceById.get(u.id) ||
                      (u.email ? presenceByEmail.get(u.email.toLowerCase()) : undefined)
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={u.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(u.name || u.email)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card" />
                            </div>
                            <span className="font-medium text-sm">{u.name || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{u.role || '—'}</Badge>
                        </TableCell>
                        {hasPresence && (
                          <TableCell>
                            {presence ? (
                              <Badge variant="secondary" className="gap-1.5 text-xs">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                                </span>
                                {presence.label}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-xs font-mono">
                          {formatDateTime(u.last_sign_in_at)} ({timeAgo(u.last_sign_in_at)})
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            disabled={!u.name}
                            onClick={() => {
                              setActivityUser(u.name)
                              setActivityOpen(true)
                            }}
                          >
                            <Eye className="w-4 h-4" />
                            Ver atividade
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <UserAuditSheet
        open={activityOpen}
        onOpenChange={setActivityOpen}
        userName={activityUser ?? ''}
      />
    </div>
  )
}
