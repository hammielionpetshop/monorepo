import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/authz'
import { getPosBranchId } from '@/lib/pos-branch'
import { serviceDeliveries, eq } from '@/lib/db'
import { listDeliveryHistory } from '@/lib/services/grooming-report-service'
import { wibDayStart } from '@/lib/grooming-order-http'
import { isCalendarDay } from '@/lib/discount-history'
import OngkirClient from './_components/ongkir-client'
import { toCashierRows, type CashierOngkirRow } from './_components/ongkir-model'

export const dynamic = 'force-dynamic'

function todayWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

function shiftDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Menu Ongkir: semua ongkir + pengantar di cabang POS yang aktif (termasuk antar-jemput grooming).
// Semua kasir boleh melihat (keputusan owner 2026-11-04); bonus pengantar tidak ditampilkan di sini.
export default async function PosOngkirPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const payload = await getAuth()
  if (!payload) redirect('/pos/login')
  const branchId = getPosBranchId(payload, await cookies())

  const params = await searchParams
  const today = todayWIB()
  const to = isCalendarDay(params.to) ? (params.to as string) : today
  const fromRaw = isCalendarDay(params.from) ? (params.from as string) : to
  const from = fromRaw <= to ? fromRaw : to

  let rows: CashierOngkirRow[] = []
  let error: string | null = null
  try {
    rows = toCashierRows(
      await listDeliveryHistory({
        branchScope: eq(serviceDeliveries.branchId, branchId),
        from: wibDayStart(from) as Date,
        to: wibDayStart(shiftDays(to, 1)) as Date,
      }),
    )
  } catch (e) {
    console.error('PosOngkirPage error:', e)
    error = 'Terjadi kesalahan saat memuat riwayat ongkir'
  }

  return <OngkirClient rows={rows} from={from} to={to} error={error} />
}
