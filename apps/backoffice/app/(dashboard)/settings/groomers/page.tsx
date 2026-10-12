import { getAuth, hasPermission } from '@/lib/authz'
import { listGroomers, type GroomerRow } from '@/lib/services/grooming-master-service'
import { NewBadge } from '@/components/ui/new-badge'
import GroomerClient from './_components/groomer-client'
import FreeShippingSetting from './_components/free-shipping-setting'
import { getFreeShippingValue } from '@/lib/ongkir-server'

export const dynamic = 'force-dynamic'

export default async function GroomersPage() {
  const payload = await getAuth()
  if (!payload || !hasPermission(payload, 'grooming.groomer.manage')) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Halaman ini hanya untuk Owner/GM. Bila Anda Owner/GM dan baru saja mendapat izin ini, keluar lalu masuk lagi.
        </div>
      </div>
    )
  }

  let data: GroomerRow[] = []
  let freeShippingValue = 0
  let error: string | null = null
  try {
    ;[data, freeShippingValue] = await Promise.all([listGroomers(), getFreeShippingValue()])
  } catch (e) {
    console.error('GroomersPage error:', e)
    error = 'Terjadi kesalahan saat mengambil daftar groomer'
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">
          Groomer &amp; Pengantar <NewBadge feature="/settings/groomers" />
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Daftar orang yang memandikan (groomer) dan yang mengantar-jemput (pengantar). Satu orang boleh keduanya. Nama
          di sini yang dipilih kasir, dan menjadi dasar hitungan bonus. Berlaku di cabang mana pun.
        </p>
      </div>
      {error ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>
      ) : (
        <>
          <FreeShippingSetting initialValue={freeShippingValue} />
          <GroomerClient groomers={data} />
        </>
      )}
    </div>
  )
}
