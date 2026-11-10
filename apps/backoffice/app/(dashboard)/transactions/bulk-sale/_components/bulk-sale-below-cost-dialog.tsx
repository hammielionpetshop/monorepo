'use client'

import { useState } from 'react'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import { describeBelowCostLine, type BelowCostLine } from '@/lib/below-cost'

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

/**
 * Bulk Sale di bawah modal: dua jendela konfirmasi berturut-turut (keputusan owner 2026-11-10 —
 * "takutnya tidak baca"). Baru setelah jendela kedua disetujui, penjualan dikirim ulang.
 */
export default function BulkSaleBelowCostDialog({
  lines,
  onConfirm,
  onCancel,
}: {
  lines: BelowCostLine[]
  onConfirm: () => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const totalLoss = lines.reduce((sum, l) => sum + l.loss, 0)

  if (step === 1) {
    return (
      <RequiredChoiceDialog
        title={`${lines.length} barang di bawah modal`}
        tone="warning"
        actions={[
          { label: 'Periksa lagi', onClick: onCancel },
          { label: 'Lanjutkan', onClick: () => setStep(2), variant: 'primary' },
        ]}
      >
        <p>Harga jual barang berikut lebih rendah dari modal cabang. Anda yakin?</p>
        <ul className="list-disc pl-5 text-muted-foreground space-y-0.5 max-h-48 overflow-auto">
          {lines.map(l => (
            <li key={`${l.productId}-${l.uomId}`}>{describeBelowCostLine(l)}</li>
          ))}
        </ul>
      </RequiredChoiceDialog>
    )
  }

  return (
    <RequiredChoiceDialog
      title="Konfirmasi kedua: penjualan RUGI"
      tone="danger"
      actions={[
        { label: 'Batal, periksa harga', onClick: onCancel },
        { label: 'Ya, simpan rugi', onClick: onConfirm, variant: 'destructive' },
      ]}
    >
      <p>
        Penjualan ini <b>RUGI {rupiah(totalLoss)}</b> dibanding modal. Penjualan rugi dicatat di Audit Log atas
        nama Anda. Yakin tetap simpan?
      </p>
    </RequiredChoiceDialog>
  )
}
