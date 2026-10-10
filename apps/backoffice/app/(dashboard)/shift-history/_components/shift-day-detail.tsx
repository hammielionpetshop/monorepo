'use client'

import type { ShiftDayRecap, ShiftDayRecapShift } from '@petshop/shared'
import { formatWIB } from '@petshop/shared'
import { buildDayRecapView } from '@/lib/settlement-day-recap'

function rupiah(value: number | null) {
  if (value == null) return '-'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

// -0 dicetak Intl sebagai "-Rp 0".
const neg = (v: number) => (v === 0 ? 0 : -v)

function time(value: Date | string | null) {
  return formatWIB(value, { hour: '2-digit', minute: '2-digit' })
}

function sumKnown(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v != null)
  return known.length > 0 ? known.reduce((a, b) => a + b, 0) : null
}

const STATUS_TEXT: Record<ShiftDayRecapShift['status'], string> = {
  OPEN: 'Berlangsung',
  CLOSED: 'Selesai',
  FORCE_CLOSED: 'Ditutup paksa',
}

/**
 * Jendela "Detail Hari" di Riwayat Shift: angka tiap shift estafet berdampingan + totalnya.
 * Setoran & verifikasi finance tetap per shift (lewat tombol Detail tiap shift).
 */
export function ShiftDayDetail({
  branchName,
  dayRecap,
  isLoading,
  error,
  canPrint,
  isPrinting,
  onPrint,
  onClose,
}: {
  branchName: string
  dayRecap: ShiftDayRecap | null | undefined
  isLoading: boolean
  error: string | null
  canPrint: boolean
  isPrinting: boolean
  onPrint: () => void
  onClose: () => void
}) {
  const view = buildDayRecapView(dayRecap)
  const shifts = view?.shifts ?? []
  const anyOpen = shifts.some((s) => s.status === 'OPEN')

  const rows: { label: string; values: string[]; total: string; bold?: boolean; hideIfZero?: boolean }[] = view
    ? [
        { label: 'Ditutup oleh', values: shifts.map((s) => s.closedByName ?? '-'), total: '' },
        { label: 'Jam', values: shifts.map((s) => `${time(s.openedAt)}–${s.status === 'OPEN' ? '…' : time(s.closedAt)}`), total: '' },
        { label: 'Status', values: shifts.map((s) => STATUS_TEXT[s.status]), total: '' },
        { label: 'Tunai', values: shifts.map((s) => rupiah(s.cashSales)), total: rupiah(view.total.cashSales) },
        { label: 'Non-Tunai', values: shifts.map((s) => rupiah(s.nonCash)), total: rupiah(view.total.nonCash) },
        { label: 'Hutang', values: shifts.map((s) => rupiah(s.debt)), total: rupiah(view.total.debt), hideIfZero: view.total.debt === 0 },
        { label: 'Diskon', values: shifts.map((s) => rupiah(neg(s.discount))), total: rupiah(neg(view.total.discount)), hideIfZero: view.total.discount === 0 },
        { label: 'Pengeluaran', values: shifts.map((s) => rupiah(neg(s.expenses))), total: rupiah(neg(view.total.expenses)), hideIfZero: view.total.expenses === 0 },
        {
          label: 'Pelunasan Piutang Tunai',
          values: shifts.map((s) => rupiah(s.debtPaymentCash)),
          total: rupiah(view.total.debtPaymentCash),
          hideIfZero: view.total.debtPaymentCash === 0,
        },
        { label: 'OMZET', values: shifts.map((s) => rupiah(s.omzet)), total: rupiah(view.total.omzet), bold: true },
        { label: 'Kas Harus Ada', values: shifts.map((s) => rupiah(s.expectedCash)), total: rupiah(sumKnown(shifts.map((s) => s.expectedCash))) },
        { label: 'Kas Disetor', values: shifts.map((s) => rupiah(s.realCash)), total: rupiah(sumKnown(shifts.map((s) => s.realCash))), bold: true },
        { label: 'Selisih', values: shifts.map((s) => rupiah(s.variance)), total: rupiah(sumKnown(shifts.map((s) => s.variance))) },
      ].filter((r) => !r.hideIfZero)
    : []

  const day = shifts[0] ? formatWIB(shifts[0].openedAt, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col m-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h3 className="text-lg font-semibold text-foreground">
            {view ? `${branchName} — ${day} (Estafet ${shifts.length} shift)` : 'Detail Hari'}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none" aria-label="Tutup">
            &times;
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-7 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">{error}</div>
          ) : !view ? (
            <p className="text-sm text-muted-foreground">Hari ini hanya ada satu shift.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 pr-4 text-left font-medium text-muted-foreground" />
                      {shifts.map((s) => (
                        <th key={s.shiftId} className="py-2 px-3 text-right font-medium text-foreground whitespace-nowrap">
                          Shift #{s.shiftNumber}
                        </th>
                      ))}
                      <th className="py-2 pl-3 text-right font-semibold text-foreground whitespace-nowrap">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.label} className={`border-b border-border/60 ${r.bold ? 'font-semibold' : ''}`}>
                        <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{r.label}</td>
                        {r.values.map((v, i) => (
                          <td key={i} className="py-2 px-3 text-right text-foreground whitespace-nowrap">{v}</td>
                        ))}
                        <td className="py-2 pl-3 text-right text-foreground whitespace-nowrap font-semibold">{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Verifikasi setoran oleh finance tetap per shift — buka tombol <span className="font-medium">Detail</span> di baris
                shift masing-masing.
                {anyOpen && ' Shift yang masih berlangsung: angkanya sementara sampai shift ditutup.'}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          {view && canPrint && (
            <button
              onClick={onPrint}
              disabled={isPrinting}
              className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors text-foreground disabled:opacity-60"
            >
              {isPrinting ? 'Mencetak...' : '🖨️ Cetak Struk Gabungan'}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
