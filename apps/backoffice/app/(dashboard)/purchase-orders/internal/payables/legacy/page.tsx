import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAuth } from '@/lib/authz'
import { LEGACY_QUICK_DATES, LEGACY_REVIEW_ROLES, LEGACY_RUN_ROLES } from '@/lib/services/legacy-settlement-rules'
import { loadLegacyPreviewData, loadLegacyRuns } from '@/lib/services/legacy-settlement-service'
import { LegacyPreviewClient } from './_components/legacy-preview-client'

export const dynamic = 'force-dynamic'

// F2-3b-1 Pratinjau (§3) + F2-3b-2 Jalankan/Batalkan pelunasan susulan (§4, Owner saja) —
// spec docs/work/specs/2026-11-08-f2-3b-utang-lama-design.md.
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
  const [preview, runs] = await Promise.all([loadLegacyPreviewData(fromDate), loadLegacyRuns()])
  const data = { ...preview, ...runs }

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/purchase-orders/internal/payables" className="text-sm text-muted-foreground hover:text-foreground">
          ← Utang Internal
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-foreground">Utang Lama (sebelum {data.cutoffDate})</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Menunjukkan apa yang terjadi bila setoran lama dipakai melunasi utang antar cabang yang lahir sebelum pelunasan
          otomatis berjalan. Angka tidak berubah sampai Owner menekan Jalankan pelunasan susulan.
        </p>
      </div>
      <LegacyPreviewClient data={data} quickDates={[...LEGACY_QUICK_DATES]} canRun={LEGACY_RUN_ROLES.includes(payload.role)} />
    </div>
  )
}
