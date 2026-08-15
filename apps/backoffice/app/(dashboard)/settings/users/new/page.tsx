import Link from 'next/link'
import { getAuth, hasPermission } from '@/lib/authz'
import { getUserFormOptions } from '../_components/form-options'
import UserForm from '../_components/user-form'

export const dynamic = 'force-dynamic'

export default async function NewUserPage() {
  const payload = await getAuth()

  // Guard halaman disamakan dengan POST /api/bo/settings/users — tanpa ini form-nya
  // tampil untuk orang yang pasti ditolak server saat menekan Simpan.
  if (!payload || !hasPermission(payload, 'user.manage')) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Anda tidak memiliki akses ke halaman ini.
        </div>
      </div>
    )
  }

  const { roles, branches } = await getUserFormOptions()

  return (
    <div className="p-6 max-w-3xl">
      <Link
        href="/settings/users"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        ← Kembali ke Manajemen Pengguna
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Tambah Pengguna</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Buat akun baru beserta cabang tugasnya.
        </p>
      </div>

      <UserForm roles={roles} branches={branches} />
    </div>
  )
}
