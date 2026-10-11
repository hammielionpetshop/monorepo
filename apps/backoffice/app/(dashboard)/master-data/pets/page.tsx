import { getAuth, hasPermission } from '@/lib/authz'
import { listPets, type PetRow } from '@/lib/services/grooming-master-service'
import { NewBadge } from '@/components/ui/new-badge'
import PetClient from './_components/pet-client'

export const dynamic = 'force-dynamic'

export default async function PetsPage() {
  const payload = await getAuth()
  if (!payload || !hasPermission(payload, 'grooming.pet.manage')) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Anda belum punya izin melihat Data Kucing. Bila izinnya baru diberikan, keluar lalu masuk lagi.
        </div>
      </div>
    )
  }

  let data: PetRow[] = []
  let error: string | null = null
  try {
    data = await listPets()
  } catch (e) {
    console.error('PetsPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data kucing'
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">
          Data Kucing <NewBadge feature="/master-data/pets" />
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Kucing pelanggan beserta pemiliknya. Pemilik yang didaftarkan di sini otomatis menjadi pelanggan. Kondisi
          kucing tidak dicatat di sini — itu ditulis setiap kali kucing diterima untuk grooming.
        </p>
      </div>
      {error ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>
      ) : (
        <PetClient pets={data} />
      )}
    </div>
  )
}
