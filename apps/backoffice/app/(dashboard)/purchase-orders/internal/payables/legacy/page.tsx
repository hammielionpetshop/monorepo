import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAuth } from '@/lib/authz'
import { LEGACY_QUICK_DATES, LEGACY_REVIEW_ROLES } from '@/lib/services/legacy-settlement-rules'
import { loadLegacyPreviewData } from '@/lib/services/legacy-settlement-service'
import { LegacyPreviewClient } from './_components/legacy-preview-client'

export const dynamic = 'force-dynamic'

// F2-3b-1 — spec docs/work/specs/2026-11-08-f2-3b-utang-lama-design.md §3. Baca saja: tidak ada tombol
// yang mengubah data di halaman ini.
export default async function LegacyPayablesPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const payload = await getAuth()
  if (!payload) redirect('/login')
  if (!LEGACY_REVIEW_ROLES.includes(payload.role)) redirect('/purchase-orders/internal/payables')

  const params = await searchParams
  const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? '') ? params.from! : LEGACY_QUICK_DATES[0].date
  const data = await loadLegacyPreviewData(fromDate)

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/purchase-orders/internal/payables" className="text-sm text-muted-foreground hover:text-foreground">
          ← Utang Internal
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-foreground">Utang Lama (sebelum {data.cutoffDate})</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pratinjau saja — tidak ada data yang berubah. Menunjukkan apa yang terjadi bila setoran lama dipakai melunasi utang
          antar cabang yang lahir sebelum pelunasan otomatis berjalan.
        </p>
      </div>
      <LegacyPreviewClient data={data} quickDates={[...LEGACY_QUICK_DATES]} />
    </div>
  )
}
