import { useState, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { uploadAvatar, uploadSignature } from '@/services/profiles'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SmartAvatarImage } from '@/components/shared/animated-avatars'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, Lock, CheckCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export function UserAvatarSection() {
  const { user, updateProfile } = useAuth()
  const ref = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    try {
      const url = await uploadAvatar(user.id, file)
      const { error } = await updateProfile({ avatarUrl: url })
      if (error) throw new Error(error)
      toast({ title: 'Avatar atualizado!' })
    } catch {
      toast({ title: 'Erro no upload', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="w-20 h-20">
        <SmartAvatarImage src={user?.avatarUrl} />
        <AvatarFallback className="text-2xl">{user?.name?.charAt(0) || 'U'}</AvatarFallback>
      </Avatar>
      <div>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          <Upload className="w-4 h-4" /> {uploading ? 'Enviando...' : 'Trocar Avatar'}
        </Button>
      </div>
    </div>
  )
}

export function UserSignatureSection() {
  const { user, updateProfile } = useAuth()
  const ref = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    try {
      const url = await uploadSignature(user.id, file)
      const { error } = await updateProfile({ assinatura: url })
      if (error) throw new Error(error)
      toast({ title: 'Assinatura atualizada!' })
    } catch {
      toast({ title: 'Erro no upload', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      {user?.assinatura ? (
        <div className="border rounded-lg p-4 bg-white">
          <img src={user.assinatura} alt="Assinatura" className="max-h-32 mx-auto object-contain" />
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg h-32 flex items-center justify-center text-sm text-muted-foreground">
          Sem assinatura cadastrada
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <Button
        variant="outline"
        size="sm"
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className="gap-2"
      >
        <Upload className="w-4 h-4" />{' '}
        {uploading ? 'Enviando...' : user?.assinatura ? 'Trocar Assinatura' : 'Upload Assinatura'}
      </Button>
    </div>
  )
}

export function ClientSignatureSection({ signature }: { signature: string | null }) {
  if (!signature)
    return (
      <div className="border-2 border-dashed rounded-lg h-20 flex items-center justify-center text-xs text-muted-foreground">
        Aguardando assinatura do cliente
      </div>
    )
  return (
    <div className="border rounded-lg p-2 bg-white">
      <img
        src={signature}
        alt="Assinatura do Cliente"
        className="max-h-20 mx-auto object-contain"
      />
    </div>
  )
}

export function ChangePasswordSection() {
  const { changePassword } = useAuth()
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPass !== confirm) {
      setError('A confirmação da nova senha não coincide com a nova senha.')
      return
    }
    if (newPass.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }

    setSaving(true)
    const { error } = await changePassword(current, newPass)
    if (error) {
      setError(error)
      toast({ title: `Erro: ${error}`, variant: 'destructive' })
    } else {
      toast({ title: 'Senha alterada com sucesso!' })
      setCurrent('')
      setNewPass('')
      setConfirm('')
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div>
        <Label>Senha atual</Label>
        <Input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          placeholder="Digite sua senha atual"
        />
      </div>
      <div>
        <Label>Nova senha</Label>
        <Input
          type="password"
          value={newPass}
          onChange={(e) => setNewPass(e.target.value)}
          required
          minLength={6}
          placeholder="Digite a nova senha"
        />
      </div>
      <div>
        <Label>Confirmação da nova senha</Label>
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          placeholder="Confirme a nova senha"
        />
      </div>
      {error && <p className="text-sm text-destructive font-medium">{error}</p>}
      <Button type="submit" disabled={saving} className="bg-primary gap-2">
        <Lock className="w-4 h-4" /> {saving ? 'Alterando...' : 'Alterar Senha'}
      </Button>
    </form>
  )
}
