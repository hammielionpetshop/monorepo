'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatWIB } from '@petshop/shared'
import { OrderDetail, ORDER_STATUS_LABELS } from '../../_components/types'

function formatCurrency(value: number) {
  return value.toLocaleString('id-ID')
}

interface Props {
  order: OrderDetail
}

export function OrderDetailClient({ order }: Props) {
  const router = useRouter()
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const statusInfo = ORDER_STATUS_LABELS[order.status]
  const isPending = order.status === 'PENDING'

  async function handleReject() {
    if (!rejectReason.trim()) {
      setErrorMsg('Alasan penolakan wajib diisi')
      return
    }
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/bo/customer-orders/${order.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Gagal menolak order')
        return
      }
      router.refresh()
    } catch {
      setErrorMsg('Terjadi kesalahan, coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/orders" className="text-sm text-muted-foreground hover:text-foreground">
          ← Kembali ke Order Masuk
        </Link>
      </div>

      <div className="flex items-start justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{order.orderNumber}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {order.customerName ?? '-'} {order.customerPhone ? `· ${order.customerPhone}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {order.branchName ?? '-'} ·{' '}
            {formatWIB(new Date(order.createdAt), {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
      </div>

      {order.status === 'REJECTED' && order.rejectReason && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <span className="font-medium">Alasan penolakan:</span> {order.rejectReason}
        </div>
      )}

      {order.status === 'CONFIRMED' && order.convertedTrxNumber && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800">
          Sudah dikonfirmasi menjadi{' '}
          <Link
            href={`/transactions?q=${encodeURIComponent(order.convertedTrxNumber)}`}
            className="font-medium underline"
          >
            transaksi {order.convertedTrxNumber}
          </Link>
        </div>
      )}

      {order.note && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-1 text-sm font-medium text-foreground">Catatan Customer</p>
          <p className="text-sm text-muted-foreground">{order.note}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Produk</th>
              <th className="px-3 py-2 text-center font-medium text-muted-foreground">Qty</th>
              <th className="px-3 py-2 text-center font-medium text-muted-foreground">UOM</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Harga (estimasi)</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <tr key={`${item.productId}-${idx}`} className="border-t border-border">
                <td className="px-3 py-2 text-foreground">{item.productName}</td>
                <td className="px-3 py-2 text-center text-foreground">{item.qty}</td>
                <td className="px-3 py-2 text-center text-foreground">{item.uomCode}</td>
                <td className="px-3 py-2 text-right text-foreground">Rp {formatCurrency(item.unitPriceSnapshot)}</td>
                <td className="px-3 py-2 text-right font-medium text-foreground">
                  Rp {formatCurrency(item.subtotalSnapshot)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td colSpan={4} className="px-3 py-2 text-right font-medium text-foreground">
                Total Estimasi
              </td>
              <td className="px-3 py-2 text-right font-semibold text-foreground">
                Rp {formatCurrency(order.estimatedTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {isPending && (
        <div className="flex flex-wrap items-start gap-3">
          <Link
            href={`/transactions/bulk-sale?fromOrder=${order.id}`}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Proses via Bulk Sale
          </Link>
          {!showRejectForm ? (
            <button
              type="button"
              onClick={() => setShowRejectForm(true)}
              className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
            >
              Tolak Order
            </button>
          ) : null}
        </div>
      )}

      {isPending && showRejectForm && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-sm font-medium text-red-900">Alasan penolakan (akan ditampilkan ke customer)</p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="mis. Stok tidak tersedia, alamat di luar jangkauan, dll."
            className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm"
          />
          {errorMsg && <p className="mt-2 text-sm text-destructive">{errorMsg}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleReject}
              disabled={submitting}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : 'Konfirmasi Tolak'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRejectForm(false)
                setErrorMsg(null)
              }}
              disabled={submitting}
              className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
