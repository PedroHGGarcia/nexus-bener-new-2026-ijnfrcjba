import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

/**
 * Nome amigável para uma rota interna da aplicação.
 * Usado tanto no broadcast de presença quanto na página de Auditoria.
 */
export function routeToLabel(path: string): string {
  if (!path) return '—'
  // Remove query/hash
  const clean = path.split('?')[0].split('#')[0]

  const map: Record<string, string> = {
    '/': 'Dashboard',
    '/dashboard': 'Dashboard',
    '/cadastros/clientes': 'Clientes',
    '/cadastros/representantes': 'Representantes',
    '/cadastros/regioes': 'Regiões',
    '/cadastros/gerentes': 'Gerentes',
    '/cadastros/prepostos': 'Prepostos',
    '/eventos': 'Eventos',
    '/projetos': 'Projetos',
    '/controle-propostas/propostas-criadas': 'Propostas Criadas',
    '/controle-propostas/emitir-proposta': 'Emitir Proposta',
    '/controle-propostas/emitir-licitacao': 'Emitir Licitação',
    '/controle-propostas/dashboard': 'Dashboard de Propostas',
    '/controle-propostas/propostas-avancadas': 'Propostas Avançadas',
    '/controle-propostas/tipos-propostas': 'Tipos de Propostas',
    '/produtos': 'Produtos',
    '/produtos/gestao-maquinas': 'Gestão de Máquinas',
    '/produtos/categorias': 'Gestão de Máquinas',
    '/produtos/marcas': 'Gestão de Máquinas',
    '/produtos/modelos': 'Gestão de Máquinas',
    '/produtos/versoes': 'Gestão de Máquinas',
    '/produtos/acessorios': 'Acessórios',
    '/produtos/alterar-precos': 'Alterar Preços',
    '/produtos/dashboard': 'Dashboard de Produtos',
    '/notificacoes': 'Notificações',
    '/historico-importacoes': 'Histórico de Importações',
    '/importar-acessorios': 'Importar Acessórios',
    '/importar-marcas': 'Importar Marcas',
    '/importar-produtos': 'Importar Produtos',
    '/importar-versoes': 'Importar Versões',
    '/importar-versoes-imagens': 'Importar Imagens de Versões',
    '/importar-imagens': 'Importar Imagens de Versões',
    '/admin/importar-base-antiga': 'Importar Base Antiga',
    '/area-atuacao': 'Área de Atuação',
    '/perfil': 'Perfil',
    '/usuarios': 'Usuários',
    '/auditoria': 'Auditoria',
    '/configuracoes': 'Configurações',
  }

  if (map[clean]) return map[clean]

  // Rotas dinâmicas — agrupa por prefixo
  if (clean.startsWith('/projetos/novo')) return 'Novo Projeto'
  if (/^\/projetos\/[^/]+\/editar$/.test(clean)) return 'Editar Projeto'
  if (/^\/projetos\/[^/]+$/.test(clean)) return 'Detalhes do Projeto'
  if (clean.startsWith('/controle-propostas/editar-proposta')) return 'Editar Proposta'
  if (clean.startsWith('/controle-propostas/proposta-pdf')) return 'PDF da Proposta'

  return clean
}

/**
 * Transmite via Supabase Realtime Presence a rota atual do usuário
 * autenticado, para que a página de Auditoria possa mostrar em qual
 * página cada usuário online está navegando.
 *
 * Deve ser montado dentro do router (usa useLocation) e dentro do
 * AuthProvider. Se o usuário não estiver autenticado, nada acontece.
 */
export function usePresence() {
  const location = useLocation()
  const { user } = useAuth()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!user?.id) return

    // Strict Mode (desenvolvimento) monta o effect duas vezes: garante que
    // qualquer canal anterior seja removido antes de criar um novo, evitando
    // "cannot add presence callbacks after subscribe()".
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase.channel('presence-online-users', {
      config: { presence: { key: user.id } },
    })

    // IMPORTANTE: registrar TODOS os callbacks ANTES de chamar subscribe().
    // O cliente Realtime não permite adicionar callbacks após subscribe().
    channel
      .on('presence', { event: 'sync' }, () => {
        // noop — apenas garante sincronismo do estado local
      })
      .on('broadcast', { event: 'presence' }, () => {
        // noop — presença usa o mecanismo nativo
      })

    channelRef.current = channel

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return
      await channel.track({
        userId: user.id,
        name: user.name || user.email,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        path: location.pathname,
        label: routeToLabel(location.pathname),
        ts: Date.now(),
      })
    })

    return () => {
      supabase.removeChannel(channel)
      if (channelRef.current === channel) {
        channelRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Atualiza a rota transmitida sempre que o usuário navega
  useEffect(() => {
    const channel = channelRef.current
    if (!channel || !user?.id) return

    channel.track({
      userId: user.id,
      name: user.name || user.email,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      path: location.pathname,
      label: routeToLabel(location.pathname),
      ts: Date.now(),
    })
  }, [location.pathname, user?.id, user?.name, user?.email, user?.role, user?.avatarUrl])
}
