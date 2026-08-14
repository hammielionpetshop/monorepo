import { getAuth, hasPermission } from '@/lib/authz'
import { getSession } from '@/lib/waha'
import WhatsappClient from './_components/whatsapp-client'

export const dynamic = 'force-dynamic'

export default async function WhatsappPage() {
  const payload = await getAuth()

  // Guard halaman: hanya OWNER (`user.manage`). Siapa pun yang bisa membuka halaman
  // ini bisa mengalihkan jalur OTP seluruh pelanggan, jadi digerbang setara halaman
  // Keamanan — middleware hanya mengurus auth, bukan hak akses.
  if (!payload || !hasPermission(payload, 'user.manage')) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Anda tidak memiliki akses ke halaman ini.
        </div>
      </div>
    )
  }

  // WAHA bisa saja sedang mati. Halaman tetap dirender dengan status kosong supaya
  // tombol "Mulai sesi" tetap tersedia — kalau melempar, tidak ada jalan memulihkan.
  let awal = null
  try {
    awal = await getSession()
  } catch (e) {
    console.error('WhatsappPage error:', e)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">WhatsApp</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Nomor pengirim kode OTP untuk portal pesanan pelanggan
        </p>
      </div>
      <WhatsappClient awal={awal} />
    </div>
  )
}
