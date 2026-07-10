import { getAuth, hasPermission } from '@/lib/authz'
import { getDefaultCredentials } from '@/lib/app-settings'
import SecurityClient from './_components/security-client'

export const dynamic = 'force-dynamic'

export default async function SecurityPage() {
  const payload = await getAuth()

  // Guard halaman: hanya pemilik hak `user.manage` (OWNER). Middleware sudah menjaga
  // auth; di sini kita cegah non-OWNER melihat/mengubah default kredensial.
  if (!payload || !hasPermission(payload, 'user.manage')) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Anda tidak memiliki akses ke halaman ini.
        </div>
      </div>
    )
  }

  let defaultPassword = ''
  let defaultPin = ''
  let error: string | null = null

  try {
    const creds = await getDefaultCredentials()
    defaultPassword = creds.password
    defaultPin = creds.pin
  } catch (e) {
    console.error('SecurityPage error:', e)
    error = 'Terjadi kesalahan saat mengambil pengaturan keamanan'
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Keamanan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Kelola kredensial default untuk akun staf baru
        </p>
      </div>
      <SecurityClient initialPassword={defaultPassword} initialPin={defaultPin} />
    </div>
  )
}
