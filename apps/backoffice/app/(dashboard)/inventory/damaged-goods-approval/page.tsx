import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { hasPermission } from '@/lib/authz'
import { getDamagedGoodsByStatus } from '@/lib/services/damaged-goods-approval'
import DamagedGoodsApprovalClient from './_components/damaged-goods-approval-client'

export const dynamic = 'force-dynamic'

export default async function DamagedGoodsApprovalPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) redirect('/login')

  if (!hasPermission(payload, 'damaged_goods.approve')) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya Owner dan GM yang dapat approve laporan barang rusak.
          </p>
        </div>
      </div>
    )
  }

  let initialRows: Awaited<ReturnType<typeof getDamagedGoodsByStatus>> = []
  let error: string | null = null
  try {
    initialRows = await getDamagedGoodsByStatus('PENDING')
  } catch (e) {
    error = e instanceof Error ? e.message : 'Gagal memuat laporan barang rusak'
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-foreground">Approval Barang Rusak</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Laporan barang rusak/kadaluarsa/hilang dari kasir menunggu persetujuan di sini. Stok
        belum dipotong sama sekali — baru dipotong (dengan nilai FIFO saat ini, bukan estimasi
        di bawah) begitu laporan di-approve. Menolak tidak mengubah stok apa pun.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      <DamagedGoodsApprovalClient initialRows={initialRows} />
    </div>
  )
}
