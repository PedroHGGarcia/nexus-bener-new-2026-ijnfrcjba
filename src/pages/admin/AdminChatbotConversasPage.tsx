import { useState, useEffect } from 'react'
import {
  ShieldAlert,
  Bot,
  User,
  Search,
  MessageSquare,
  Clock,
  Eye,
  ArrowLeft,
  Calendar,
  AlertTriangle,
  History,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Info,
  RefreshCw,
} from 'lucide-react'
import {
  adminListChatbotUsers,
  adminListUserConversations,
  adminGetConversationMessages,
  adminListChatbotAuditLogs,
  type ChatAdminUserSummary,
  type ChatConversation,
  type ChatAdminAuditLog,
  type ChatMessage,
} from '@/services/versoes-chatbot'
import { sanitizeChatText } from '@/components/produtos/VersoesChatbot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function AdminChatbotConversasPage() {
  const [users, setUsers] = useState<ChatAdminUserSummary[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<ChatAdminUserSummary | null>(null)

  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  const [auditLogs, setAuditLogs] = useState<ChatAdminAuditLog[]>([])
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [activeTab, setActiveTab] = useState<'conversas' | 'auditoria'>('conversas')

  // Carrega lista de usuários
  const loadUsers = async () => {
    try {
      setLoadingUsers(true)
      const data = await adminListChatbotUsers()
      setUsers(data)
    } catch (err) {
      toast({
        title: 'Erro ao carregar usuários',
        description: err instanceof Error ? err.message : 'Falha na comunicação com o servidor',
        variant: 'destructive',
      })
    } finally {
      setLoadingUsers(false)
    }
  }

  // Carrega logs de auditoria
  const loadAuditLogs = async () => {
    try {
      setLoadingAudit(true)
      const logs = await adminListChatbotAuditLogs()
      setAuditLogs(logs)
    } catch (err) {
      toast({
        title: 'Erro ao carregar logs',
        description: err instanceof Error ? err.message : 'Falha ao buscar auditoria',
        variant: 'destructive',
      })
    } finally {
      setLoadingAudit(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // Quando o admin clica em um usuário, lista as conversas dele
  const handleSelectUser = async (u: ChatAdminUserSummary) => {
    setSelectedUser(u)
    setSelectedConversation(null)
    setMessages([])
    try {
      setLoadingConversations(true)
      const res = await adminListUserConversations(u.id)
      setConversations(res.conversations)
    } catch (err) {
      toast({
        title: 'Erro ao buscar conversas',
        description:
          err instanceof Error
            ? err.message
            : 'Não foi possível listar as conversas deste usuário.',
        variant: 'destructive',
      })
    } finally {
      setLoadingConversations(false)
    }
  }

  // Quando o admin seleciona uma conversa específica para visualização somente leitura
  const handleOpenConversation = async (conv: ChatConversation) => {
    if (!selectedUser) return
    setSelectedConversation(conv)
    try {
      setLoadingMessages(true)
      const res = await adminGetConversationMessages(
        selectedUser.id,
        conv.id,
        `Auditoria administrativa solicitada na tela de Admin Chatbot para o usuário ${selectedUser.email}`,
      )
      setMessages(res.messages)
      toast({
        title: 'Acesso auditado registrado',
        description: `Visualização da conversa de ${selectedUser.name || selectedUser.email} registrada nos logs de segurança.`,
      })
      // Recarrega lista de auditoria caso a aba seja aberta
      loadAuditLogs()
    } catch (err) {
      toast({
        title: 'Erro ao abrir histórico',
        description:
          err instanceof Error ? err.message : 'Falha ao recuperar mensagens da conversa.',
        variant: 'destructive',
      })
    } finally {
      setLoadingMessages(false)
    }
  }

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase()
    return (
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.role && u.role.toLowerCase().includes(term))
    )
  })

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-6">
      {/* Header institucional Bener */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#0b3c26] text-white">
              <Bot className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Conversas do Chatbot • Visão de Admin
            </h1>
            <Badge
              variant="outline"
              className="bg-[#0b3c26]/10 text-[#0b3c26] border-[#0b3c26]/30 font-semibold"
            >
              Somente Leitura
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Acompanhe com privacidade o atendimento da assistente Bener Tech I.A para cada usuário
            da equipe.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadUsers()
              if (selectedUser) handleSelectUser(selectedUser)
              loadAuditLogs()
            }}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* AVISO LEGAL E DE PRIVACIDADE OBRIGATÓRIO */}
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-950 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs leading-relaxed">
            <p className="font-semibold text-sm">Aviso de Privacidade, Auditoria e LGPD</p>
            <p>
              Esta área possui finalidade estritamente administrativa e de suporte à equipe
              comercial. Todo acesso, visualização ou consulta a conversas de usuários é{' '}
              <strong>
                registrado com data, hora, IP e identificação do administrador responsável
              </strong>{' '}
              na tabela de auditoria interna. O acesso é exclusivamente em modo{' '}
              <strong>somente leitura</strong> (nenhuma mensagem ou conversa pode ser modificada por
              administradores).
            </p>
          </div>
        </div>
      </div>

      {/* Tabs: Navegação entre Conversas e Histórico de Auditoria */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as 'conversas' | 'auditoria')
          if (v === 'auditoria') loadAuditLogs()
        }}
      >
        <TabsList className="bg-muted">
          <TabsTrigger value="conversas" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Conversas por Usuário
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-2">
            <History className="w-4 h-4" />
            Logs de Auditoria de Acessos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversas" className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[620px]">
            {/* Coluna 1: Lista de Usuários (4 cols) */}
            <Card className="md:col-span-4 flex flex-col h-full border-border">
              <CardHeader className="p-4 pb-3 border-b">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Usuários ({users.length})</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {filteredUsers.length} exibidos
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Selecione um usuário para inspecionar suas sessões
                </CardDescription>
                <div className="relative pt-2">
                  <Search className="w-4 h-4 absolute left-2.5 top-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por nome, email ou cargo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 text-xs h-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-2 flex-1 overflow-y-auto divide-y divide-border/50 max-h-[580px]">
                {loadingUsers ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Carregando usuários...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Nenhum usuário encontrado com o termo informado.
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected = selectedUser?.id === u.id
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectUser(u)}
                        className={cn(
                          'w-full text-left p-3 rounded-lg transition-colors flex items-start gap-3 cursor-pointer',
                          isSelected
                            ? 'bg-[#0b3c26]/10 border border-[#0b3c26]/30 text-foreground'
                            : 'hover:bg-muted/60 text-foreground',
                        )}
                      >
                        <div className="w-9 h-9 rounded-full bg-[#0b3c26]/10 text-[#0b3c26] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-[#0b3c26]/20">
                          {u.name ? u.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-semibold truncate text-foreground">
                              {u.name || 'Sem nome'}
                            </p>
                            {u.totalConversas > 0 ? (
                              <Badge
                                variant="secondary"
                                className="text-[10px] h-5 px-1.5 shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              >
                                {u.totalConversas}{' '}
                                {u.totalConversas === 1 ? 'conversa' : 'conversas'}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                Sem conversas
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                            <span className="capitalize">{u.role || 'Usuário'}</span>
                            {u.ultimaConversaEm && (
                              <>
                                <span>•</span>
                                <span>
                                  Ativo em{' '}
                                  {new Date(u.ultimaConversaEm).toLocaleDateString('pt-BR')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </CardContent>
            </Card>

            {/* Coluna 2: Detalhes das conversas do usuário ou Leitura da conversa (8 cols) */}
            <Card className="md:col-span-8 flex flex-col h-full border-border">
              {!selectedUser ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3 text-muted-foreground">
                    <User className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    Nenhum usuário selecionado
                  </h3>
                  <p className="text-xs max-w-sm">
                    Selecione um usuário na coluna ao lado para visualizar a lista de sessões de
                    chatbot dele.
                  </p>
                </div>
              ) : selectedConversation ? (
                // TELA DE CONVERSA EM MODO SOMENTE LEITURA
                <div className="flex flex-col h-full">
                  <CardHeader className="p-4 border-b bg-muted/20">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedConversation(null)}
                          className="h-8 px-2 gap-1 text-xs"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Voltar à lista
                        </Button>
                        <div className="truncate">
                          <h3 className="text-sm font-bold text-foreground truncate">
                            {selectedConversation.titulo || 'Conversa sem título'}
                          </h3>
                          <p className="text-[11px] text-muted-foreground">
                            Usuário: <strong>{selectedUser.name || selectedUser.email}</strong> •
                            Criada em{' '}
                            {new Date(selectedConversation.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className="shrink-0 bg-blue-500/10 text-blue-700 border-blue-500/30 text-[11px]"
                      >
                        Acesso Auditado
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 flex-1 overflow-y-auto space-y-3 max-h-[520px]">
                    {loadingMessages ? (
                      <div className="p-8 text-center text-xs text-muted-foreground">
                        Carregando mensagens da conversa...
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground">
                        Nenhuma mensagem encontrada nesta conversa.
                      </div>
                    ) : (
                      messages.map((m, idx) => (
                        <div
                          key={m.id || idx}
                          className={cn(
                            'flex items-start gap-2.5',
                            m.role === 'user' ? 'justify-end' : 'justify-start',
                          )}
                        >
                          {m.role === 'assistant' && (
                            <div className="w-7 h-7 rounded-full bg-[#0b3c26] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                              IA
                            </div>
                          )}

                          <div
                            className={cn(
                              'text-xs rounded-xl p-3 whitespace-pre-line break-words leading-relaxed max-w-[85%]',
                              m.role === 'user'
                                ? 'bg-[#0b3c26] text-white shadow-xs ml-auto'
                                : 'bg-muted/80 text-foreground border shadow-xs',
                            )}
                          >
                            <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-75 font-medium">
                              <span>
                                {m.role === 'user'
                                  ? selectedUser.name || 'Usuário'
                                  : 'Bener Tech I.A'}
                              </span>
                              {m.timestamp && (
                                <span>{new Date(m.timestamp).toLocaleTimeString('pt-BR')}</span>
                              )}
                            </div>

                            <p>{sanitizeChatText(m.content)}</p>

                            {m.tableData && m.tableData.rows && (
                              <div className="mt-2 text-[11px] p-2 rounded bg-background/50 border">
                                <span className="font-semibold text-[10px] block mb-1">
                                  Tabela gerada ({m.tableData.rows.length} itens)
                                </span>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-[10px] border-collapse">
                                    <thead>
                                      <tr className="border-b">
                                        {m.tableData.headers.map((h, i) => (
                                          <th
                                            key={i}
                                            className="px-1.5 py-1 text-left font-semibold"
                                          >
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {m.tableData.rows.slice(0, 5).map((row, rI) => (
                                        <tr key={rI} className="border-b border-border/40">
                                          {row.map((cell, cI) => (
                                            <td key={cI} className="px-1.5 py-1">
                                              {cell}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {m.feedback && (
                              <div className="mt-2 pt-1 border-t border-border/40 flex items-center gap-1 text-[10px] text-muted-foreground">
                                <span>Avaliação do usuário:</span>
                                {m.feedback === 'like' ? (
                                  <span className="text-emerald-600 flex items-center gap-0.5 font-semibold">
                                    <ThumbsUp className="w-3 h-3" /> Útil
                                  </span>
                                ) : (
                                  <span className="text-rose-600 flex items-center gap-0.5 font-semibold">
                                    <ThumbsDown className="w-3 h-3" /> Não ajudou
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </div>
              ) : (
                // LISTA DE CONVERSAS DO USUÁRIO SELECIONADO
                <div className="flex flex-col h-full">
                  <CardHeader className="p-4 border-b bg-muted/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <span>Conversas de {selectedUser.name || selectedUser.email}</span>
                          <Badge variant="secondary" className="text-xs">
                            {conversations.length} total
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {selectedUser.email} • {selectedUser.role || 'Cargo não informado'}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 flex-1 overflow-y-auto">
                    {loadingConversations ? (
                      <div className="p-8 text-center text-xs text-muted-foreground">
                        Carregando histórico de conversas...
                      </div>
                    ) : conversations.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground">
                        Este usuário ainda não iniciou nenhuma conversa com a Bener Tech I.A.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {conversations.map((conv) => (
                          <div
                            key={conv.id}
                            className="p-3.5 rounded-lg border bg-card hover:bg-muted/40 transition-colors flex items-center justify-between gap-4"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-[#0b3c26] shrink-0" />
                                <h4 className="text-sm font-semibold truncate text-foreground">
                                  {conv.titulo || 'Conversa sem título'}
                                </h4>
                                {conv.ativa && (
                                  <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/30 text-[10px] h-5">
                                    Sessão Ativa
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  Iniciada em {new Date(conv.created_at).toLocaleString('pt-BR')}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  Última mensagem em{' '}
                                  {new Date(conv.updated_at).toLocaleString('pt-BR')}
                                </span>
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenConversation(conv)}
                              className="gap-1.5 shrink-0 hover:bg-[#0b3c26] hover:text-white"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver histórico
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Logs de Auditoria */}
        <TabsContent value="auditoria" className="space-y-4 pt-2">
          <Card className="border-border">
            <CardHeader className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-600" />
                    Trilha de Auditoria do Chatbot
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Registro de todas as vezes que um administrador visualizou conversas de usuários
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={loadAuditLogs} className="gap-1 text-xs">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Recarregar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingAudit ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Carregando trilha de auditoria...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Nenhum registro de visualização administrativa efetuado até o momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b text-muted-foreground font-semibold">
                        <th className="px-4 py-2.5">Data e Hora</th>
                        <th className="px-4 py-2.5">Administrador</th>
                        <th className="px-4 py-2.5">Usuário Alvo</th>
                        <th className="px-4 py-2.5">Identificador da Conversa</th>
                        <th className="px-4 py-2.5">Motivo Registrado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            {log.admin_email}
                          </td>
                          <td className="px-4 py-2.5 text-foreground">
                            {log.target_user_email || log.target_user_id}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                            {log.conversa_id ? log.conversa_id.substring(0, 13) + '...' : '-'}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">
                            {log.motivo || 'Consulta administrativa'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
