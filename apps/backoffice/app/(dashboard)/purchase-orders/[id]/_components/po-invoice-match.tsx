'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface InvoiceMatchItem {
  id: number
  productName: string | null
  uomCode: string | null
  qtyReceived: string
  unitCost: string
  invoiceUnitCost: string | null
}

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

/**
 * Cocokkan harga faktur supplier dengan harga PO setelah barang datang. Harga faktur disimpan
 * ke `invoiceUnitCost`; modal mengikuti sistem yang sudah ada — dipakai sebagai modal batch
 * saat penerimaan disetujui, atau lewat sinkron modal bila penerimaan sudah disetujui.
 */
export default function PoInvoiceMatch({
  poId,
  invoiceNumber,
  items,
  receivingApproved,
  hasPendingPrice,
}: {
  poId: number
  invoiceNumber: string | null
  items: InvoiceMatchItem[]
  receivingApproved: boolean
  hasPendingPrice: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState(invoiceNumber ?? '')
  const [prices, setPrices] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      items.map((i) => {
        const cost = Math.round(Number(i.invoiceUnitCost ?? i.unitCost))
        return [i.id, cost > 0 ? String(cost) : '']
      }),
    ),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const totalPo = items.reduce((s, i) => s + Number(i.qtyReceived) * Number(i.unitCost), 0)
  const totalInvoice = items.reduce((s, i) => s + Number(i.qtyReceived) * (Number(prices[i.id]) || 0), 0)

  async function save() {
    setError('')
    if (!number.trim()) return setError('Nomor faktur wajib diisi')
    for (const i of items) {
      const v = Number(prices[i.id] || 0)
      if (!Number.isFinite(v) || v < 0) return setError(`Harga faktur ${i.productName ?? ''} tidak valid`)
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/bo/purchase-orders/${poId}/update-invoice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: number.trim(),
          items: items.map((i) => ({ id: i.id, invoiceUnitCost: Math.round(Number(prices[i.id] || 0)) })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal menyimpan harga faktur')
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan harga faktur')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          hasPendingPrice
            ? 'bg-amber-600 text-white hover:bg-amber-700'
            : 'border border-border hover:bg-muted/50'
        }`}
      >
        {hasPendingPrice ? 'Isi Harga Beli' : invoiceNumber ? 'Ubah Harga Faktur' : 'Cocokkan Harga Faktur'}
      </button>
    )
  }

  return (
    <div className="w-full rounded-lg border border-border p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Cocokkan Harga Faktur Supplier</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {receivingApproved
            ? 'Penerimaan sudah disetujui — modal stok dari PO ini diganti ke harga faktur, dan modal di Manajemen Harga diperbarui lewat sinkron modal (perubahan ≥30% perlu persetujuan).'
            : 'Harga faktur dipakai sebagai modal saat penerimaan disetujui.'}
          {hasPendingPrice && ' Harga yang dibiarkan kosong tetap tercatat "harga menyusul".'}
        </p>
      </div>
      <label className="block text-sm">
        <span className="text-muted-foreground">No. Faktur</span>
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          className="mt-1 w-full max-w-xs border border-border rounded-md px-3 py-2 text-sm bg-background"
        />
      </label>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Produk</th>
              <th className="px-3 py-2 text-right">Qty Terima</th>
              <th className="px-3 py-2 text-right">Harga PO</th>
              <th className="px-3 py-2 text-right">Harga Faktur</th>
              <th className="px-3 py-2 text-right">Selisih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((i) => {
              const po = Number(i.unitCost)
              const inv = Number(prices[i.id]) || 0
              const diff = inv - po
              return (
                <tr key={i.id}>
                  <td className="px-3 py-2">{i.productName ?? '-'}</td>
                  <td className="px-3 py-2 text-right">
                    {Number(i.qtyReceived)} {i.uomCode}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{po > 0 ? rupiah(po) : 'menyusul'}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      value={prices[i.id] ?? ''}
                      onChange={(e) => setPrices((p) => ({ ...p, [i.id]: e.target.value }))}
                      className="w-32 border border-border rounded px-2 py-1 text-right text-sm bg-background"
                    />
                  </td>
                  <td
                    className={`px-3 py-2 text-right ${diff > 0 ? 'text-destructive' : diff < 0 ? 'text-green-600' : 'text-muted-foreground'}`}
                  >
                    {diff === 0 || po <= 0 ? '—' : `${diff > 0 ? '+' : ''}${rupiah(diff)}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Total diterima: PO {rupiah(totalPo)} → Faktur <span className="font-semibold text-foreground">{rupiah(totalInvoice)}</span>
        </p>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-destructive">{error}</span>}
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={saving}
            className="px-4 py-2 text-sm border border-border rounded-md text-muted-foreground hover:bg-muted/50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Simpan Harga Faktur'}
          </button>
        </div>
      </div>
    </div>
  )
}
