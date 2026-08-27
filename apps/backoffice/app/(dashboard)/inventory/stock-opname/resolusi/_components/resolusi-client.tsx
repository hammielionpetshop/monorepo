'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import type { SOResolutionQueueItem } from '@/lib/services/stock-opname-resolution-report'
import type { EmployeeOption } from '../page'

interface Props {
  initialQueue: SOResolutionQueueItem[]
  employeeOptions: EmployeeOption[]
}

type Disposition = 'FOUND' | 'WRITTEN_OFF' | 'EMPLOYEE_CHARGE' | 'OVERAGE_EXPLAINED'

const DISPOSITION_LABELS: Record<Disposition, string> = {
  FOUND: 'Ternyata ditemukan',
  WRITTEN_OFF: 'Kerugian toko (write-off)',
  EMPLOYEE_CHARGE: 'Dibebankan ke karyawan',
  OVERAGE_EXPLAINED: 'Lebih — dijelaskan',
}

interface ChargeRow {
  key: number
  employeeName: string
  employeeId: number | null
  amount: string
  note: string
}

function formatRupiah(value: number | null | undefined): string {
  if (value == null) return '-'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)
}

let chargeRowKeySeq = 0
function newChargeRow(): ChargeRow {
  chargeRowKeySeq += 1
  return { key: chargeRowKeySeq, employeeName: '', employeeId: null, amount: '', note: '' }
}

export default function ResolusiClient({ initialQueue, employeeOptions }: Props) {
  const router = useRouter()
  const [queue, setQueue] = useState<SOResolutionQueueItem[]>(initialQueue)
  const [modalItem, setModalItem] = useState<SOResolutionQueueItem | null>(null)
  const [disposition, setDisposition] = useState<Disposition | null>(null)
  const [note, setNote] = useState('')
  const [charges, setCharges] = useState<ChargeRow[]>([newChargeRow()])
  const [manualCostPricePerUnit, setManualCostPricePerUnit] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const employeeByName = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of employeeOptions) map.set(e.name.trim().toLowerCase(), e.id)
    return map
  }, [employeeOptions])

  function openModal(item: SOResolutionQueueItem) {
    setModalItem(item)
    setDisposition(item.varianceQty < 0 ? null : 'OVERAGE_EXPLAINED')
    setNote('')
    setCharges([newChargeRow()])
    setManualCostPricePerUnit('')
    setModalError(null)
  }

  function closeModal() {
    setModalItem(null)
    setDisposition(null)
  }

  function updateCharge(key: number, patch: Partial<ChargeRow>) {
    setCharges((prev) =>
      prev.map((c) => {
        if (c.key !== key) return c
        const next = { ...c, ...patch }
        if (patch.employeeName !== undefined) {
          next.employeeId = employeeByName.get(patch.employeeName.trim().toLowerCase()) ?? null
        }
        return next
      })
    )
  }

  // Selisih minus yang HPP-nya tidak berhasil dihitung otomatis saat SO (varianceCostValue
  // null) wajib diisi harga modal manual sebelum bisa diresolusi — sistem tidak pernah
  // menebak nol untuk kasus yang benar-benar tidak diketahui HPP-nya.
  const needsManualCost =
    modalItem != null &&
    modalItem.varianceCostValue == null &&
    disposition != null &&
    disposition !== 'OVERAGE_EXPLAINED'
  const manualCostValue =
    needsManualCost && manualCostPricePerUnit.trim() !== ''
      ? Number(manualCostPricePerUnit) * Math.abs(modalItem!.varianceQty)
      : null

  const allocatedTotal = charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
  const targetValue = modalItem?.varianceCostValue ?? manualCostValue ?? 0
  const storePortion = Math.max(0, targetValue - allocatedTotal)

  async function submitResolution() {
    if (!modalItem || !disposition) return

    if (!note.trim()) {
      setModalError('Catatan wajib diisi')
      return
    }

    if (needsManualCost && (manualCostPricePerUnit.trim() === '' || Number(manualCostPricePerUnit) <= 0)) {
      setModalError('Harga modal tidak ditemukan otomatis — isi harga modal per unit terlebih dahulu')
      return
    }

    let employeeCharges: { employeeName: string; employeeId: number | null; amount: number; note?: string }[] | undefined
    if (disposition === 'EMPLOYEE_CHARGE') {
      const filled = charges.filter((c) => c.employeeName.trim() !== '' || c.amount.trim() !== '')
      if (filled.length === 0) {
        setModalError('Minimal satu karyawan wajib diisi')
        return
      }
      const invalid = filled.find((c) => c.employeeName.trim() === '' || Number(c.amount) <= 0)
      if (invalid) {
        setModalError('Setiap baris karyawan wajib punya nama dan nominal lebih dari 0')
        return
      }
      if (allocatedTotal > targetValue) {
        setModalError('Total yang dialokasikan tidak boleh melebihi nilai selisih')
        return
      }
      employeeCharges = filled.map((c) => ({
        employeeName: c.employeeName.trim(),
        employeeId: c.employeeId,
        amount: Number(c.amount),
        note: c.note.trim() || undefined,
      }))
    }

    setSubmitting(true)
    setModalError(null)
    try {
      const res = await fetch(`/api/bo/stock-opnames/items/${modalItem.itemId}/resolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disposition,
          note: note.trim(),
          employeeCharges,
          manualCostPricePerUnit: needsManualCost ? Number(manualCostPricePerUnit) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setModalError(data.error ?? `Gagal menyimpan resolusi (${res.status})`)
        return
      }

      setQueue((prev) => prev.filter((i) => i.itemId !== modalItem.itemId))
      setSuccessMsg(`${modalItem.productName} berhasil diresolusi (${DISPOSITION_LABELS[disposition]})`)
      closeModal()
      router.refresh()
    } catch {
      setModalError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  const dispositionOptions: Disposition[] = modalItem
    ? modalItem.varianceQty < 0
      ? ['FOUND', 'WRITTEN_OFF', 'EMPLOYEE_CHARGE']
      : ['OVERAGE_EXPLAINED']
    : []

  const queueColumns: ColumnDef<SOResolutionQueueItem, unknown>[] = [
    {
      accessorKey: 'soNumber',
      header: 'No. SO',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.soNumber}</span>,
    },
    {
      accessorKey: 'branchName',
      header: 'Cabang',
    },
    {
      accessorKey: 'productName',
      header: 'Produk',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.productName}</p>
          {row.original.sku && <p className="text-xs text-muted-foreground">SKU: {row.original.sku}</p>}
        </div>
      ),
    },
    {
      accessorKey: 'decidedAt',
      header: 'Diputuskan',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.decidedAt ? formatWIB(row.original.decidedAt) : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'varianceQty',
      header: 'Selisih Qty',
      cell: ({ row }) => (
        <span
          className={`font-medium ${row.original.varianceQty < 0 ? 'text-destructive' : 'text-emerald-600'}`}
        >
          {row.original.varianceQty > 0 ? '+' : ''}
          {row.original.varianceQty} {row.original.uomCode}
        </span>
      ),
    },
    {
      accessorKey: 'varianceCostValue',
      header: 'Nilai Selisih',
      cell: ({ row }) => formatRupiah(row.original.varianceCostValue),
    },
    {
      id: 'alasanAsli',
      header: 'Alasan Asli',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.varianceReason ?? row.original.varianceCategory ?? '-'}
        </span>
      ),
    },
    {
      id: 'aksi',
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => openModal(row.original)}
          className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Selesaikan
        </button>
      ),
    },
  ]

  return (
    <div>
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm mb-4">
          {successMsg}
        </div>
      )}

      <DataTable
        data={queue}
        columns={queueColumns}
        emptyMessage="Tidak ada item selisih yang menunggu resolusi pada filter ini."
        pageSize={15}
        enableSorting
      />

      {modalItem && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" role="presentation" onClick={closeModal} />
          <div className="fixed inset-x-4 top-8 bottom-8 z-50 mx-auto max-w-xl overflow-y-auto rounded-2xl bg-background shadow-xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-foreground">Selesaikan Selisih</h2>
              <button type="button" onClick={closeModal} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {modalItem.productName} &middot; {modalItem.soNumber} &middot; selisih{' '}
              <span className={modalItem.varianceQty < 0 ? 'text-destructive font-medium' : 'text-emerald-600 font-medium'}>
                {modalItem.varianceQty > 0 ? '+' : ''}
                {modalItem.varianceQty} {modalItem.uomCode}
              </span>{' '}
              (
              {modalItem.varianceCostValue != null
                ? formatRupiah(modalItem.varianceCostValue)
                : 'HPP tidak diketahui — isi manual di bawah'}
              )
            </p>

            {modalError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm mb-3">
                {modalError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Disposisi</label>
                <div className="space-y-1">
                  {dispositionOptions.map((d) => (
                    <label key={d} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="disposition"
                        checked={disposition === d}
                        onChange={() => setDisposition(d)}
                      />
                      {DISPOSITION_LABELS[d]}
                    </label>
                  ))}
                </div>
              </div>

              {needsManualCost && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Harga Modal per Unit
                  </label>
                  <p className="text-xs text-muted-foreground mb-1">
                    Sistem tidak berhasil menghitung HPP otomatis untuk item ini. Isi harga modal per{' '}
                    {modalItem.uomCode} secara manual.
                  </p>
                  <input
                    value={manualCostPricePerUnit}
                    onChange={(e) => setManualCostPricePerUnit(e.target.value.replace(/[^0-9]/g, ''))}
                    inputMode="numeric"
                    placeholder="Rp per unit"
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                  />
                  {manualCostValue != null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Total nilai selisih: {formatRupiah(manualCostValue)} ({Math.abs(modalItem.varianceQty)}{' '}
                      {modalItem.uomCode} &times; {formatRupiah(Number(manualCostPricePerUnit))})
                    </p>
                  )}
                </div>
              )}

              {disposition === 'EMPLOYEE_CHARGE' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Karyawan yang menanggung
                  </label>
                  <datalist id="employee-suggestions">
                    {employeeOptions.map((e) => (
                      <option key={e.id} value={e.name} />
                    ))}
                  </datalist>
                  <div className="space-y-2">
                    {charges.map((c) => (
                      <div key={c.key} className="flex gap-2 items-start">
                        <input
                          list="employee-suggestions"
                          value={c.employeeName}
                          onChange={(e) => updateCharge(c.key, { employeeName: e.target.value })}
                          placeholder="Nama karyawan (boleh di luar daftar)"
                          className="flex-1 border border-input rounded-md px-2 py-1.5 text-sm bg-background"
                        />
                        <input
                          value={c.amount}
                          onChange={(e) => updateCharge(c.key, { amount: e.target.value.replace(/[^0-9]/g, '') })}
                          inputMode="numeric"
                          placeholder="Rp"
                          className="w-28 border border-input rounded-md px-2 py-1.5 text-sm bg-background"
                        />
                        <button
                          type="button"
                          onClick={() => setCharges((prev) => prev.filter((row) => row.key !== c.key))}
                          className="px-2 py-1.5 text-muted-foreground hover:text-destructive"
                          aria-label="Hapus baris"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCharges((prev) => [...prev, newChargeRow()])}
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                  >
                    + Tambah karyawan
                  </button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Rp {allocatedTotal.toLocaleString('id-ID')} dari {formatRupiah(targetValue)} dialokasikan
                    {storePortion > 0 && (
                      <> &middot; sisa <span className="font-medium">{formatRupiah(storePortion)}</span> otomatis jadi kerugian toko</>
                    )}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Catatan</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Jelaskan hasil investigasi/alasan disposisi ini..."
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={submitResolution}
                disabled={submitting || !disposition}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Resolusi'}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
