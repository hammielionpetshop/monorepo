import { redirect } from 'next/navigation'
import { getAuth, hasPermission } from '@/lib/authz'
import { db, branches, eq } from '@/lib/db'
import { getCostReviews, MARGIN_ALERT_PERCENT } from '@/lib/services/cost-sync-service'
import CostReviewClient from './_components/cost-review-client'

export const dynamic = 'force-dynamic'

export default async function CostReviewPage() {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  if (!hasPermission(payload, 'master.price.manage')) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya Owner dan GM yang dapat meninjau modal & margin.
          </p>
        </div>
      </div>
    )
  }

  const branchList = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(eq(branches.isActive, true))
    .orderBy(branches.name)

  let initialReviews: Awaited<ReturnType<typeof getCostReviews>> = []
  let error: string | null = null
  try {
    initialReviews = await getCostReviews('PENDING')
  } catch (e) {
    error = e instanceof Error ? e.message : 'Gagal memuat tinjauan modal'
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-foreground mb-1">Tinjauan Modal & Margin</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Modal di Manajemen Harga kini diperbarui otomatis dari barang masuk (PO, faktur PO, terima
        transfer internal, penambahan stok bermodal). Perubahan di bawah 30% langsung diterapkan;
        lompatan 30% atau lebih, dan pengembalian modal setelah penerimaan PO dibatalkan, menunggu
        persetujuan di sini. Tab Margin menampilkan harga jual yang marginnya {MARGIN_ALERT_PERCENT}%
        atau kurang terhadap modal — baris hilang sendiri setelah harga jualnya dinaikkan.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      <CostReviewClient initialReviews={initialReviews} branches={branchList} />
    </div>
  )
}
