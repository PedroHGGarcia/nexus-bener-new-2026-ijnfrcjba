import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
const SeedLogosPage = lazy(() => import('./pages/SeedLogosPage'))
import { AuthProvider } from '@/hooks/use-auth'
import { ThemeProvider } from '@/hooks/use-theme'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RoleGuard } from '@/components/RoleGuard'
import Layout from '@/components/Layout'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

// v0.0.261 - force rebuild chunk for public route /visualizar-proposta/:id
// Lazy loaded public pages
const Login = lazy(() => import('./pages/Login'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ValidarProposta = lazy(() => import('./pages/ValidarProposta'))
const ImprimirProposta = lazy(() => import('./pages/ImprimirProposta'))
const VisualizarProposta = lazy(() => import('./pages/VisualizarProposta'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Lazy loaded protected pages
const Index = lazy(() => import('./pages/Dashboard'))
const Dashboard = lazy(() => import('./pages/Dashboard'))

// Cadastros
const ClientesPage = lazy(() => import('./pages/cadastros/ClientesPage'))
const RepresentantesPage = lazy(() => import('./pages/cadastros/RepresentantesPage'))
const RegioesPage = lazy(() => import('./pages/cadastros/RegioesPage'))
const GerentesPage = lazy(() => import('./pages/cadastros/GerentesPage'))
const PrepostosPage = lazy(() => import('./pages/cadastros/PrepostosPage'))

// Eventos & Projetos
const EventosPage = lazy(() => import('./pages/EventosPage'))
const ProjetosListPage = lazy(() => import('./pages/projetos/ProjetosListPage'))
const ProjetoNovoPage = lazy(() => import('./pages/projetos/ProjetoNovoPage'))
const ProjetoDetailPage = lazy(() => import('./pages/projetos/ProjetoDetailPage'))
const ProjetoEditarPage = lazy(() => import('./pages/projetos/ProjetoEditarPage'))

// Propostas
const PropostasCriadasPage = lazy(() => import('./pages/propostas/PropostasCriadasPage'))
const EmitirPropostaPage = lazy(() => import('./pages/propostas/EmitirPropostaPage'))
const EditarPropostaPage = lazy(() => import('./pages/propostas/EditarPropostaPage'))
const EmitirLicitacaoPage = lazy(() => import('./pages/propostas/EmitirLicitacaoPage'))
const PropostasDashboardPage = lazy(() => import('./pages/propostas/PropostasDashboardPage'))
const PropostasAvancadasPage = lazy(() => import('./pages/propostas/PropostasAvancadasPage'))
const TiposPropostasPage = lazy(() => import('./pages/propostas/TiposPropostasPage'))
const PropostaPdfPage = lazy(() => import('./pages/propostas/PropostaPdfPage'))

// Produtos
const GestaoMaquinasPage = lazy(() => import('./pages/produtos/GestaoMaquinasPage'))
const ProdutosListPage = lazy(() => import('./pages/produtos/ProdutosListPage'))
const AcessoriosPage = lazy(() => import('./pages/produtos/AcessoriosPage'))
const ImportarAcessoriosPage = lazy(() => import('./pages/ImportarAcessoriosPage'))
const ImportarTiposPropostasPage = lazy(() => import('./pages/ImportarTiposPropostasPage'))
const ImportarMarcasPage = lazy(() => import('./pages/ImportarMarcasPage'))
const ImportarProdutosPage = lazy(() => import('./pages/ImportarProdutosPage'))
const ImportarModelosPage = lazy(() => import('./pages/ImportarModelosPage'))
const ImportarRepresentantesPage = lazy(() => import('./pages/ImportarRepresentantesPage'))
const ImportarVersoesPage = lazy(() => import('./pages/ImportarVersoesPage'))
const ImportarImagensVersoesPage = lazy(() => import('./pages/ImportarImagensVersoesPage'))
const AlterarPrecosPage = lazy(() => import('./pages/produtos/AlterarPrecosPage'))
const ProdutosDashboardPage = lazy(() => import('./pages/produtos/ProdutosDashboardPage'))
const QuarentenaMaquinasPage = lazy(() => import('./pages/produtos/QuarentenaMaquinasPage'))
const HistoricoAlteracoesCatalogoPage = lazy(
  () => import('./pages/produtos/HistoricoAlteracoesCatalogoPage'),
)

// Outras páginas
const NotificacoesPage = lazy(() => import('./pages/NotificacoesPage'))
const HistoricoImportacoesPage = lazy(() => import('./pages/HistoricoImportacoesPage'))
const ImportarBaseAntigaPage = lazy(() => import('./pages/admin/ImportarBaseAntigaPage'))
const AreaAtuacaoPage = lazy(() => import('./pages/AreaAtuacaoPage'))
const PerfilPage = lazy(() => import('./pages/PerfilPage'))
const MeusVendedoresPage = lazy(() => import('./pages/MeusVendedoresPage'))
const UsuariosPage = lazy(() => import('./pages/UsuariosPage'))
const AuditoriaPage = lazy(() => import('./pages/AuditoriaPage'))
const ConfiguracoesPage = lazy(() => import('./pages/ConfiguracoesPage'))

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Carregando Bener Nexus...
        </span>
      </div>
    </div>
  )
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/seed-logos" element={<SeedLogosPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/redefinir-senha" element={<ForgotPassword />} />
              <Route path="/validar-proposta/:token" element={<ValidarProposta />} />
              <Route path="/validar-proposta/:id" element={<ValidarProposta />} />
              <Route path="/visualizar-proposta/:token" element={<VisualizarProposta />} />
              <Route path="/visualizar-proposta/:id" element={<VisualizarProposta />} />
              <Route path="/proposta/:id/imprimir" element={<ImprimirProposta />} />

              {/* Protected Routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Index />} />
                <Route path="/dashboard" element={<Dashboard />} />

                {/* Cadastros */}
                <Route path="/cadastros/clientes" element={<ClientesPage />} />
                <Route
                  path="/cadastros/representantes"
                  element={
                    <RoleGuard disallowedRole={['Vendedor', 'Representante']}>
                      <RepresentantesPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/cadastros/regioes"
                  element={
                    <RoleGuard disallowedRole={['Vendedor', 'Representante']}>
                      <RegioesPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/cadastros/gerentes"
                  element={
                    <RoleGuard disallowedRole={['Vendedor', 'Representante']}>
                      <GerentesPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/cadastros/prepostos"
                  element={
                    <RoleGuard disallowedRole={['Vendedor', 'Representante']}>
                      <PrepostosPage />
                    </RoleGuard>
                  }
                />
                {/* Eventos */}
                <Route path="/eventos" element={<EventosPage />} />

                {/* Projetos */}
                <Route path="/projetos" element={<ProjetosListPage />} />
                <Route path="/projetos/novo" element={<ProjetoNovoPage />} />
                <Route path="/projetos/:id" element={<ProjetoDetailPage />} />
                <Route path="/projetos/:id/editar" element={<ProjetoEditarPage />} />

                {/* Controle de Propostas */}
                <Route
                  path="/controle-propostas/propostas-criadas"
                  element={<PropostasCriadasPage />}
                />
                <Route
                  path="/controle-propostas/emitir-proposta"
                  element={<EmitirPropostaPage />}
                />
                <Route
                  path="/controle-propostas/editar-proposta/:id"
                  element={<EditarPropostaPage />}
                />
                <Route
                  path="/controle-propostas/emitir-licitacao"
                  element={
                    <RoleGuard disallowedRole={['Vendedor', 'Representante']}>
                      <EmitirLicitacaoPage />
                    </RoleGuard>
                  }
                />
                <Route path="/controle-propostas/dashboard" element={<PropostasDashboardPage />} />
                <Route
                  path="/controle-propostas/propostas-avancadas"
                  element={<PropostasAvancadasPage />}
                />
                <Route
                  path="/controle-propostas/tipos-propostas"
                  element={
                    <RoleGuard disallowedRole={['Vendedor', 'Representante']}>
                      <TiposPropostasPage />
                    </RoleGuard>
                  }
                />
                <Route path="/controle-propostas/proposta-pdf/:id" element={<PropostaPdfPage />} />

                {/* Produtos */}
                <Route path="/produtos" element={<ProdutosListPage />} />
                <Route
                  path="/produtos/gestao-maquinas"
                  element={
                    <RoleGuard disallowedRole={['Vendedor', 'Representante']}>
                      <GestaoMaquinasPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/produtos/categorias"
                  element={
                    <RoleGuard disallowedRole={['Vendedor', 'Representante']}>
                      <GestaoMaquinasPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/produtos/marcas"
                  element={
                    <RoleGuard disallowedRole={['Vendedor', 'Representante']}>
                      <GestaoMaquinasPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/produtos/modelos"
                  element={
                    <RoleGuard disallowedRole={['Vendedor', 'Representante']}>
                      <GestaoMaquinasPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/produtos/versoes"
                  element={
                    <RoleGuard disallowedRole={['Vendedor', 'Representante']}>
                      <GestaoMaquinasPage />
                    </RoleGuard>
                  }
                />
                <Route path="/produtos/acessorios" element={<AcessoriosPage />} />
                <Route
                  path="/importar-acessorios"
                  element={
                    <RoleGuard requiredRole={['Admin Completo', 'admin']}>
                      <ImportarAcessoriosPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/importar-tipos-proposta"
                  element={
                    <RoleGuard requiredRole={['Admin Completo', 'admin', 'Gerente', 'gerente']}>
                      <ImportarTiposPropostasPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/importar-marcas"
                  element={
                    <RoleGuard requiredRole={['Admin Completo', 'admin']}>
                      <ImportarMarcasPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/importar-produtos"
                  element={
                    <RoleGuard requiredRole={['Admin Completo', 'admin']}>
                      <ImportarProdutosPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/importar-modelos"
                  element={
                    <RoleGuard requiredRole={['Admin Completo', 'admin']}>
                      <ImportarModelosPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/importar-representantes"
                  element={
                    <RoleGuard requiredRole={['Admin Completo', 'admin']}>
                      <ImportarRepresentantesPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/importar-versoes"
                  element={
                    <RoleGuard requiredRole={['Admin Completo', 'admin']}>
                      <ImportarVersoesPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/importar-versoes-imagens"
                  element={
                    <RoleGuard requiredRole={['Admin Completo', 'admin']}>
                      <ImportarImagensVersoesPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/importar-imagens"
                  element={
                    <RoleGuard requiredRole={['Admin Completo', 'admin']}>
                      <ImportarImagensVersoesPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/produtos/alterar-precos"
                  element={
                    <RoleGuard disallowedRole={['Vendedor', 'Representante']}>
                      <AlterarPrecosPage />
                    </RoleGuard>
                  }
                />
                <Route path="/produtos/dashboard" element={<ProdutosDashboardPage />} />
                <Route
                  path="/produtos/quarentena"
                  element={
                    <RoleGuard requiredRole={['Admin Completo', 'admin']}>
                      <QuarentenaMaquinasPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/produtos/historico-alteracoes"
                  element={
                    <RoleGuard requiredRole={['Admin Completo', 'admin']}>
                      <HistoricoAlteracoesCatalogoPage />
                    </RoleGuard>
                  }
                />

                {/* Suporte e Gestão */}
                <Route path="/notificacoes" element={<NotificacoesPage />} />
                <Route path="/historico-importacoes" element={<HistoricoImportacoesPage />} />
                <Route
                  path="/admin/importar-base-antiga"
                  element={
                    <RoleGuard requiredRole={['Admin Completo', 'admin']}>
                      <ImportarBaseAntigaPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/admin/importar-base"
                  element={<Navigate to="/admin/importar-base-antiga" replace />}
                />
                <Route
                  path="/area-atuacao"
                  element={
                    <RoleGuard disallowedRole={['Vendedor', 'Representante']}>
                      <AreaAtuacaoPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/meus-vendedores"
                  element={
                    <RoleGuard requiredRole={['Admin Completo', 'admin', 'Gerente', 'gerente']}>
                      <MeusVendedoresPage />
                    </RoleGuard>
                  }
                />
                <Route path="/perfil" element={<PerfilPage />} />
                <Route
                  path="/usuarios"
                  element={
                    <RoleGuard requiredRole={['Admin Completo', 'admin']}>
                      <UsuariosPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/auditoria"
                  element={
                    <RoleGuard requiredRole={['Admin Completo', 'admin']}>
                      <AuditoriaPage />
                    </RoleGuard>
                  }
                />
                <Route path="/configuracoes" element={<ConfiguracoesPage />} />
              </Route>

              {/* 404 Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
