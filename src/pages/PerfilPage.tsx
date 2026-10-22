import { useState, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { uploadSignature } from '@/services/profiles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { User, Lock, PenTool, Upload, CheckCircle } from 'lucide-react'

export default function PerfilPage() {
  const { user, updateProfile, changePassword } = useAuth()
  const signatureInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(user?.name || '')
  const [setor, setSetor] = useState(user?.setor || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [uploadingSig, setUploadingSig] = useState(false)

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    const { error } = await updateProfile({ name, setor })
    if (error) toast.error(`Erro: ${error}`)
    else toast.success('Perfil atualizado com sucesso!')
    setSavingProfile(false)
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')

    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação da nova senha não coincide com a nova senha.')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (!currentPassword) {
      setPasswordError('Informe sua senha atual.')
      return
    }

    setSavingPassword(true)
    const { error } = await changePassword(currentPassword, newPassword)
    if (error) {
      setPasswordError(error)
      toast.error(`Erro: ${error}`)
    } else {
      toast.success('Senha alterada com sucesso!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPassword(false)
  }

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingSig(true)
    try {
      const url = await uploadSignature(user.id, file)
      const { error } = await updateProfile({ assinatura: url })
      if (error) throw new Error(error)
      toast.success('Assinatura atualizada!')
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : 'Falha no upload'}`)
    }
    setUploadingSig(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Meu Perfil</h1>
      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" /> Dados
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2">
            <Lock className="w-4 h-4" /> Senha
          </TabsTrigger>
          <TabsTrigger value="signature" className="gap-2">
            <PenTool className="w-4 h-4" /> Assinatura
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div>
                  <Label>Nome Completo</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input value={user?.email || ''} disabled />
                </div>
                <div>
                  <Label>Setor</Label>
                  <Input
                    value={setor}
                    onChange={(e) => setSetor(e.target.value)}
                    placeholder="Ex: Vendas, Técnico, Financeiro"
                  />
                </div>
                <div>
                  <Label>Perfil / Role</Label>
                  <Input value={user?.role || ''} disabled />
                </div>
                <Button type="submit" disabled={savingProfile} className="bg-primary w-full gap-2">
                  {savingProfile ? (
                    'Salvando...'
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" /> Salvar Perfil
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alterar Senha</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <Label>Senha atual</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Digite sua senha atual"
                  />
                </div>
                <div>
                  <Label>Nova senha</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Digite a nova senha"
                  />
                </div>
                <div>
                  <Label>Confirmação da nova senha</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Confirme a nova senha"
                  />
                </div>
                {passwordError && (
                  <p className="text-sm text-destructive font-medium">{passwordError}</p>
                )}
                <Button type="submit" disabled={savingPassword} className="bg-primary w-full gap-2">
                  {savingPassword ? (
                    'Alterando...'
                  ) : (
                    <>
                      <Lock className="w-4 h-4" /> Alterar Senha
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signature" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assinatura Digital</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {user?.assinatura && (
                <div className="border rounded-lg p-4 bg-white">
                  <img
                    src={user.assinatura}
                    alt="Assinatura"
                    className="max-h-32 mx-auto object-contain"
                  />
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Faça upload de uma imagem da sua assinatura para uso em propostas e documentos.
              </p>
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSignatureUpload}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => signatureInputRef.current?.click()}
                disabled={uploadingSig}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />{' '}
                {uploadingSig
                  ? 'Enviando...'
                  : user?.assinatura
                    ? 'Trocar Assinatura'
                    : 'Upload Assinatura'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
