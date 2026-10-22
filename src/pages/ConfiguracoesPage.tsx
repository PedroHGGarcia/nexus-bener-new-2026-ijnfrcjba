import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { fetchPreferencias, savePreferencia } from '@/services/preferencias'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Save, Palette, Globe, Bell, Table } from 'lucide-react'
import { toast } from 'sonner'

export default function ConfiguracoesPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [theme, setTheme] = useState('light')
  const [language, setLanguage] = useState('pt-BR')
  const [notificationsOn, setNotificationsOn] = useState(true)
  const [pageSize, setPageSize] = useState('10')

  const loadPreferences = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const prefs = await fetchPreferencias(user.id)
      if (prefs.theme) setTheme(prefs.theme as string)
      if (prefs.language) setLanguage(prefs.language as string)
      if (typeof prefs.notifications_enabled === 'boolean')
        setNotificationsOn(prefs.notifications_enabled)
      if (prefs.default_page_size) setPageSize(String(prefs.default_page_size))
    } catch {
      /* defaults are fine */
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  const applyTheme = (newTheme: string) => {
    setTheme(newTheme)
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('bener_theme', newTheme)
  }

  const handleSave = async () => {
    if (!user?.id) return
    setSaving(true)
    try {
      await Promise.all([
        savePreferencia(user.id, 'theme', theme),
        savePreferencia(user.id, 'language', language),
        savePreferencia(user.id, 'notifications_enabled', notificationsOn),
        savePreferencia(user.id, 'default_page_size', Number(pageSize)),
      ])
      toast.success('Preferências salvas com sucesso!')
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : 'Falha ao salvar'}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" /> Aparência
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Tema</Label>
              <p className="text-xs text-muted-foreground">Escolha o modo de exibição</p>
            </div>
            <Select value={theme} onValueChange={applyTheme}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="flex items-center gap-1">
                <Globe className="w-4 h-4" /> Idioma
              </Label>
              <p className="text-xs text-muted-foreground">Idioma da interface</p>
            </div>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-BR">Português</SelectItem>
                <SelectItem value="en-US">English</SelectItem>
                <SelectItem value="es-ES">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" /> Notificações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>Receber notificações</Label>
              <p className="text-xs text-muted-foreground">Ativar alertas no sistema</p>
            </div>
            <Switch checked={notificationsOn} onCheckedChange={setNotificationsOn} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Table className="w-5 h-5 text-primary" /> Preferências de Tabela
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>Tamanho padrão de página</Label>
              <p className="text-xs text-muted-foreground">Registros por página nas listagens</p>
            </div>
            <Select value={pageSize} onValueChange={setPageSize}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="bg-primary gap-2 w-full" disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar Preferências
      </Button>
    </div>
  )
}
