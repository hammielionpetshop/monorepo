'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatWIB } from '@petshop/shared'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  APPROVED: { label: 'Siap Diterima', color: 'bg-blue-100 text-blue-800' },
  IN_TRANSIT: { label: 'Dalam Pengiriman', color: 'bg-purple-100 text-purple-800' },
  PARTIALLY_RECEIVED: { label: 'Diterima Sebagian', color: 'bg-orange-100 text-orange-800' },
}

interface POSummary {
  id: number
  poNumber: string
  status: string
  totalAmount: number
  notes: string | null
  targetDeliveryDate: string | null
  createdAt: string
  supplier: { id: number; name: string; phone: string | null }
}

interface POItem {
  id: number
  productId: number
  productName: string
  productSku: string | null
  uomId: number
  uomCode: string
  qtyOrdered: number
  qtyReceived: number
  qtyDamaged: number
  unitCost: number
  expiryDate: string | null
}

interface PODetail extends POSummary {
  items: POItem[]
}

interface ReceivingItemState {
  poItemId: number
  qtyReceived: string
  qtyDamaged: string
  expiryDate: string
  note: string
}

interface ReceivingClientProps {
  pos: POSummary[]
  currentUserId: number
  branchId: number
}

export function ReceivingClient({ pos, currentUserId, branchId }: ReceivingClientProps) {
  const router = useRouter()
  const [selectedPO, setSelectedPO] = useState<PODetail | null>(null)
  const [loadingPOId, setLoadingPOId] = useState<number | null>(null)
  const [receivingItems, setReceivingItems] = useState<ReceivingItemState[]>([])
  const [invoiceReceived, setInvoiceReceived] = useState(false)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleSelectPO = async (po: POSummary) => {
    setLoadingPOId(po.id)
    setError('')
    setSuccessMessage('')
    try {
      const res = await fetch(`/api/bo/purchase-orders/${po.id}`)
      const detail: PODetail = await res.json()
      setSelectedPO(detail)
      setReceivingItems(
        detail.items.map(item => {
          const remaining = item.qtyOrdered - item.qtyReceived
          return {
            poItemId: item.id,
            qtyReceived: remaining > 0 ? String(remaining) : '0',
            qtyDamaged: '0',
            expiryDate: '',
            note: '',
          }
        })
      )
      setInvoiceReceived(false)
      setNote('')
    } catch {
      setError('Gagal mengambil detail PO. Coba lagi.')
    } finally {
      setLoadingPOId(null)
    }
  }

  const handleBack = () => {
    setSelectedPO(null)
    setReceivingItems([])
    setError('')
    setSuccessMessage('')
  }

  const handleItemChange = (index: number, field: keyof ReceivingItemState, value: string) => {
    setReceivingItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const handleSubmit = async () => {
    if (!selectedPO) return
    setError('')

    // Validate
    for (let i = 0; i < receivingItems.length; i++) {
      const ri = receivingItems[i]
      const item = selectedPO.items[i]
      const qty = parseFloat(ri.qtyReceived)
      const dmg = parseFloat(ri.qtyDamaged)
      if (isNaN(qty) || qty < 0) {
        return setError(`Qty terima untuk ${item.productName} tidak valid`)
      }
      if (isNaN(dmg) || dmg < 0) {
        return setError(`Qty rusak untuk ${item.productName} tidak valid`)
      }
      if (dmg > qty) {
        return setError(`Qty rusak tidak boleh melebihi qty terima untuk ${item.productName}`)
      }
    }

    const hasAnyReceived = receivingItems.some(ri => parseFloat(ri.qtyReceived) > 0)
    if (!hasAnyReceived) {
      return setError('Masukkan qty yang diterima minimal untuk satu item')
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/pos/purchase-orders/${selectedPO.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedById: currentUserId,
          invoiceReceived,
          note: note.trim() || null,
          items: receivingItems.map(ri => ({
            poItemId: ri.poItemId,
            qtyReceived: Math.round(parseFloat(ri.qtyReceived) || 0),
            qtyDamaged: Math.round(parseFloat(ri.qtyDamaged) || 0),
            expiryDate: ri.expiryDate || null,
            note: ri.note.trim() || null,
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Gagal menyimpan penerimaan')
        return
      }

      setSuccessMessage(`PO ${selectedPO.poNumber} berhasil dicatat sebagai diterima.`)
      setSelectedPO(null)
      setReceivingItems([])
      router.refresh()
    } catch {
      setError('Terjadi kesalahan. Coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---- Detail / Receiving Form ----
  if (selectedPO) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            disabled={isSubmitting}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            ← Kembali
          </button>
          <div>
            <h1 className="text-base font-semibold text-foreground">{selectedPO.poNumber}</h1>
            <p className="text-xs text-muted-foreground">{selectedPO.supplier.name}</p>
          </div>
        </div>

        {/* Items Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Produk</th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-12">Pesan</th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-12">Sisa</th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-20">Diterima</th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-20">Rusak</th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-28">Exp. Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {selectedPO.items.map((item, i) => {
                const remaining = item.qtyOrdered - item.qtyReceived
                const ri = receivingItems[i]
                return (
                  <tr key={item.id} className={remaining <= 0 ? 'opacity-50' : ''}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-foreground text-xs">{item.productName}</div>
                      <div className="text-xs text-muted-foreground">{item.uomCode}</div>
                    </td>
                    <td className="px-2 py-2.5 text-center text-xs text-muted-foreground">
                      {item.qtyOrdered}
                    </td>
                    <td className="px-2 py-2.5 text-center text-xs font-medium text-foreground">
                      {remaining}
                    </td>
                    <td className="px-2 py-2.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={ri ? (parseInt(ri.qtyReceived, 10) || 0).toLocaleString('id-ID') : '0'}
                        onChange={e => handleItemChange(i, 'qtyReceived', e.target.value.replace(/\D/g, '') || '0')}
                        disabled={remaining <= 0 || isSubmitting}
                        className="w-full border border-border rounded px-2 py-1 text-xs text-center bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={ri ? (parseInt(ri.qtyDamaged, 10) || 0).toLocaleString('id-ID') : '0'}
                        onChange={e => handleItemChange(i, 'qtyDamaged', e.target.value.replace(/\D/g, '') || '0')}
                        disabled={remaining <= 0 || isSubmitting}
                        className="w-full border border-border rounded px-2 py-1 text-xs text-center bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <input
                        type="date"
                        value={ri?.expiryDate ?? ''}
                        onChange={e => handleItemChange(i, 'expiryDate', e.target.value)}
                        disabled={remaining <= 0 || isSubmitting}
                        className="w-full border border-border rounded px-1.5 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Invoice & Note */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={invoiceReceived}
              onChange={e => setInvoiceReceived(e.target.checked)}
              disabled={isSubmitting}
              className="w-4 h-4 rounded border-border"
            />
            <span className="text-sm text-foreground">Invoice/surat jalan diterima</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Catatan (opsional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              disabled={isSubmitting}
              rows={2}
              placeholder="Catatan kondisi barang, dll."
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none disabled:opacity-50"
            />
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={handleBack}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm border border-border rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Penerimaan'}
          </button>
        </div>
      </div>
    )
  }

  // ---- PO List ----
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-base font-semibold text-foreground">Penerimaan Barang</h1>
        <p className="text-xs text-muted-foreground mt-0.5">PO yang sudah disetujui dan siap diterima</p>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-md text-sm">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      {pos.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Tidak ada Purchase Order yang siap diterima.
        </div>
      ) : (
        <div className="space-y-2">
          {pos.map(po => {
            const statusInfo = STATUS_LABELS[po.status] ?? { label: po.status, color: 'bg-gray-100 text-gray-600' }
            const isLoading = loadingPOId === po.id
            return (
              <button
                key={po.id}
                onClick={() => handleSelectPO(po)}
                disabled={loadingPOId !== null}
                className="w-full text-left border border-border rounded-lg px-4 py-3 hover:bg-muted/30 transition-colors disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm text-foreground">{po.poNumber}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{po.supplier.name}</p>
                    {po.targetDeliveryDate && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Target: {formatWIB(po.targetDeliveryDate, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-foreground">
                      Rp {Number(po.totalAmount).toLocaleString('id-ID')}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatWIB(po.createdAt, { day: 'numeric', month: 'short' })}
                    </div>
                    {isLoading && (
                      <div className="text-xs text-primary mt-1">Memuat...</div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
