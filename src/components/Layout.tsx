import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'
import { ErrorBoundary } from './ErrorBoundary'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { VersoesChatbot } from '@/components/produtos/VersoesChatbot'
import { usePresence } from '@/hooks/usePresence'
import { useActivityTracker } from '@/hooks/use-activity-tracker'

export default function Layout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Rastreia a presença do usuário atual (rota/nome/email) em toda a aplicação
  usePresence()
  // Rastreia e persiste o touch da última atividade (last_seen_at) do usuário
  useActivityTracker()

  return (
    <ErrorBoundary>
      <div className="h-screen w-full bg-[#f3f4f6] dark:bg-background flex overflow-hidden font-sans">
        {/* Desktop Sidebar - Full Height from top 0 */}
        <aside className="hidden md:block shrink-0 h-full z-20">
          <AppSidebar />
        </aside>

        {/* Mobile Drawer Sidebar */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent
            side="left"
            className="p-0 w-60 bg-[#0b3c26] border-none inset-y-0 h-full rounded-none [&>button]:text-white [&>button]:top-4 [&>button]:right-4"
          >
            <AppSidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main Content Area + Header on the Right */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
          <AppHeader onToggleMobileSidebar={() => setMobileSidebarOpen(true)} />
          <main className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-3 md:p-4 lg:p-5 max-w-7xl mx-auto w-full pb-24 md:pb-20">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <VersoesChatbot />
    </ErrorBoundary>
  )
}
