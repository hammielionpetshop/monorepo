import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/authz'
import { todayWibDate } from '@/lib/payment-date'
import { canManageCashCounts, canRecordCashCounts } from '@/lib/services/cash-count-access'
import CashCountClient from './_components/cash-count-client'

export const dynamic = 'force-dynamic'

export default async function CashCountsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const payload = await getAuth()
  if (!payload) redirect('/login')
  if (!canRecordCashCounts(payload)) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Hitung Kas hanya untuk Owner, GM, dan Finance.
        </div>
      </div>
    )
  }
  const params = await searchParams
  const adjustId = Number(params.adjust)
  const adjustAmount = Number(params.amount)
  // Tautan dari web Finance: /cash-counts?adjust=<id>&direction=SHORT|OVER&amount=<n>
  const prefill = Number.isInteger(adjustId) && adjustId > 0
    ? {
        countId: adjustId,
        direction: params.direction === 'OVER' ? ('OVER' as const) : ('SHORT' as const),
        amount: Number.isInteger(adjustAmount) && adjustAmount > 0 ? adjustAmount : null,
        month: /^\d{4}-\d{2}$/.test(params.month ?? '') ? params.month! : null,
      }
    : null

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Hitung Kas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Catat uang yang benar-benar ada di Tunai (brankas, kas Finance) dan saldo Rekening menurut mutasi bank, pada akhir hari
          tanggal hitung. Saldo menurut catatan tidak ditampilkan di sini; selisihnya dibaca Owner/GM di web Finance. Laci kasir
          tidak dihitung di sini karena sudah dihitung tiap tutup shift.
        </p>
      </div>
      <CashCountClient
        canManage={canManageCashCounts(payload)}
        today={todayWibDate()}
        prefill={prefill}
      />
    </div>
  )
}
