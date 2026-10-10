/** Selisih harga terhadap harga terakhir/rencana yang memicu peringatan (sama dengan batas sinkron modal). */
export const COST_JUMP_THRESHOLD = 0.3

export interface ReceivingLineInput {
  name: string
  uomCode: string
  /** Sisa pesanan yang belum diterima; 0 = baris tidak bisa diisi. */
  remaining: number
  qty: number
  damaged: number
  /** Harga diketik; 0 = kosong. */
  price: number
  /** Harga terakhir, atau harga rencana bila belum ada; 0 = tidak ada pembanding. */
  referencePrice: number
}

export interface ReceivingWarning {
  kind: 'ZERO_QTY' | 'NO_PRICE' | 'COST_JUMP'
  title: string
  message: string
  lines: string[]
  backLabel: string
  continueLabel: string
}

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

/**
 * Peringatan sebelum penerimaan disimpan, urut ditampilkan satu per satu sebagai jendela wajib
 * klik: qty 0 → harga kosong → harga melonjak. Kosong = langsung simpan.
 */
export function receivingWarnings(lines: ReceivingLineInput[]): ReceivingWarning[] {
  const warnings: ReceivingWarning[] = []

  const zeroQty = lines.filter(l => l.remaining > 0 && l.qty === 0)
  if (zeroQty.length > 0) {
    warnings.push({
      kind: 'ZERO_QTY',
      title: `${zeroQty.length} barang diisi 0`,
      message: 'Barang berikut dicatat TIDAK DATANG. Yakin?',
      lines: zeroQty.map(l => `${l.name} (sisa ${l.remaining} ${l.uomCode})`),
      backLabel: 'Periksa lagi',
      continueLabel: 'Ya, tidak datang',
    })
  }

  const noPrice = lines.filter(l => l.qty - l.damaged > 0 && l.price <= 0)
  if (noPrice.length > 0) {
    warnings.push({
      kind: 'NO_PRICE',
      title: `${noPrice.length} barang belum ada harga`,
      message:
        'Stok tetap masuk dengan harga perkiraan, tapi PO ini akan berada di tab "Belum Ada Harga" sampai harga faktur diisi.',
      lines: noPrice.map(l => l.name),
      backLabel: 'Isi harga sekarang',
      continueLabel: 'Lanjut tanpa harga',
    })
  }

  const jumps = lines.filter(
    l =>
      l.qty > 0 &&
      l.price > 0 &&
      l.referencePrice > 0 &&
      Math.abs(l.price - l.referencePrice) / l.referencePrice >= COST_JUMP_THRESHOLD,
  )
  if (jumps.length > 0) {
    warnings.push({
      kind: 'COST_JUMP',
      title: `Harga ${jumps.length} barang beda jauh`,
      message: 'Harga yang diketik berbeda jauh dari harga sebelumnya. Pastikan tidak salah ketik (kelebihan/kurang angka 0).',
      lines: jumps.map(l => {
        const pct = Math.round(((l.price - l.referencePrice) / l.referencePrice) * 100)
        return `${l.name}: ${rupiah(l.referencePrice)} → ${rupiah(l.price)} (${pct > 0 ? '+' : ''}${pct}%)`
      }),
      backLabel: 'Periksa lagi',
      continueLabel: 'Ya, sudah benar',
    })
  }

  return warnings
}
