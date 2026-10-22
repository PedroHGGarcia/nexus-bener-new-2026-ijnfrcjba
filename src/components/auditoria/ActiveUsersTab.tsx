import { useState, useMemo } from 'react'
import { ActiveUserItem } from '@/services/activity-tracker'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { Search, RotateCcw, Eye, Radio, Sparkles } from 'lucide-react'
import { formatFriendlyLastSeen, isUserRecentlyActive } from '@/lib/friendly-date'

interface ActiveUsersTabProps {
  users: ActiveUserItem[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onSelectUserActivity: (userName: string) => void
}

function getInitials(name: string) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function ActiveUsersTab({
  users,
  loading,
  error,
  onRefresh,
  onSelectUserActivity,
}: ActiveUsersTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterActiveNowOnly, setFilterActiveNowOnly] = useState(false)

  // Filtra e classifica
  const filteredUsers = useMemo(() => {
    let result = [...users]

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q),
      )
    }

    if (filterActiveNowOnly) {
      result = result.filter((u) => isUserRecentlyActive(u.last_seen_at, 15))
    }

    return result
  }, [users, searchTerm, filterActiveNowOnly])

  // Contagem de usuários online agora (< 15 minutos)
  const onlineCount = useMemo(() => {
    return users.filter((u) => isUserRecentlyActive(u.last_seen_at, 15)).length
  }, [users])

  // Contagem de usuários com alguma atividade detectada
  const detectedCount = useMemo(() => {
    return users.filter((u) => Boolean(u.last_seen_at)).length
  }, [users])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-full max-w-sm bg-muted animate-pulse rounded" />
        <LoadingState count={6} />
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRefresh} />
  }

  return (
    <div className="space-y-4">
      {/* Barra de resumo com estatísticas visuais limpas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border shadow-none bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Em Atividade Agora
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-foreground">{onlineCount}</span>
                <span className="text-xs text-muted-foreground">últimos 15 min</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-none bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Com Atividade Detectada
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-foreground">{detectedCount}</span>
                <span className="text-xs text-muted-foreground">de {users.length} usuários</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-none bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total de Usuários
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-foreground">{users.length}</span>
                <span className="text-xs text-muted-foreground">cadastrados</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Radio className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles simples e limpos: busca por nome/e-mail + botão rápido "Apenas Online Agora" */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="flex-1 flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm('')}
              className="text-xs h-9 px-2"
            >
              Limpar
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant={filterActiveNowOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterActiveNowOnly(!filterActiveNowOnly)}
            className="text-xs h-9 gap-1.5"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                filterActiveNowOnly ? 'bg-white' : 'bg-emerald-500'
              }`}
            />
            {filterActiveNowOnly ? 'Mostrando Apenas Online' : 'Filtrar Online Agora'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="text-xs h-9 gap-1.5"
            title="Recarregar lista"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Tabela de Usuários Ativos */}
      {filteredUsers.length === 0 ? (
        <EmptyState
          title="Nenhum usuário encontrado"
          description={
            filterActiveNowOnly
              ? 'Nenhum usuário esteve ativo nos últimos 15 minutos.'
              : searchTerm
                ? 'Nenhum usuário corresponde aos termos pesquisados.'
                : 'Não há usuários cadastrados.'
          }
        />
      ) : (
        <div className="border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[280px]">Usuário</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Visto por último</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => {
                const isOnline = isUserRecentlyActive(u.last_seen_at, 15)
                const friendlySeen = formatFriendlyLastSeen(u.last_seen_at)

                return (
                  <TableRow
                    key={u.id}
                    className={`hover:bg-muted/50 transition-colors ${
                      isOnline ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''
                    }`}
                  >
                    {/* Nome + Avatar com indicador verde se online */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="w-9 h-9 border">
                            <AvatarImage src={u.avatar_url || undefined} alt={u.name} />
                            <AvatarFallback className="text-xs font-semibold bg-muted">
                              {getInitials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          {isOnline && (
                            <span
                              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background shadow-sm"
                              title="Online nos últimos 15 minutos"
                            />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm truncate text-foreground">
                              {u.name}
                            </span>
                            {isOnline && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] h-4 px-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-medium"
                              >
                                Online
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* E-mail */}
                    <TableCell className="text-sm text-muted-foreground font-mono text-xs">
                      {u.email}
                    </TableCell>

                    {/* Papel */}
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {u.role}
                      </Badge>
                    </TableCell>

                    {/* Status da Conta */}
                    <TableCell>
                      <Badge
                        variant={u.status === 'Ativo' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {u.status}
                      </Badge>
                    </TableCell>

                    {/* Visto por último (amigável para público sênior) */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span
                          className={`text-sm ${
                            isOnline
                              ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                              : u.last_seen_at
                                ? 'text-foreground'
                                : 'text-muted-foreground italic'
                          }`}
                        >
                          {friendlySeen}
                        </span>
                        {u.last_seen_at && (
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(u.last_seen_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Ação: Ver trilha do usuário */}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        disabled={!u.name}
                        onClick={() => onSelectUserActivity(u.name)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver trilha
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
