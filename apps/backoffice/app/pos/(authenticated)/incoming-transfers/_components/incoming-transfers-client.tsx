'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatWIB } from '@petshop/shared'

interface TransferItem {
  id: number
  transferId: number
  productId: number
  productName: string | null
  productSku: string | null
  uomId: number
  uomCode: string | null
  qtyRequested: number
  qtyShipped: number
  costPriceAtTransfer: number
}

interface Transfer {
  id: number
  ibtNumber: string
  sourceBranchId: number
  sourceBranchName: string | null
  status: string
  notes: string | null
  createdAt: string
  requestedByName: string | null
  items: TransferItem[]
}

interface Props {
  transfers: Transfer[]
}

export function IncomingTransfersClient({ transfers }: Props) {
  const router = useRouter()
  const [receivingId, setReceivingId] = useState<number | null>(null)
  const [receiveQty, setReceiveQty] = useState<Record<number, number>>({})
  const [receiveNotes, setReceiveNotes] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  function openReceive(transfer: Transfer) {
    setReceivingId(transfer.id)
    setReceiveQty(Object.fromEntries(transfer.items.map((i) => [i.id, i.qtyShipped])))
    setReceiveNotes({})
    setErrorMsg(null)
  }

  function closeReceive() {
    setReceivingId(null)
    setReceiveQty({})
    setReceiveNotes({})
    setErrorMsg(null)
  }

  async function handleReceive(transferId: number, items: TransferItem[]) {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/bo/internal-transfers/${transferId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'receive',
          items: items.map((i) => ({
            itemId: i.id,
            qty: receiveQty[i.id] ?? 0,
            notes: receiveNotes[i.id] || undefined,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan')
      setSuccessMsg('Penerimaan berhasil dikonfirmasi — stok diperbarui')
      closeReceive()
      setTimeout(() => setSuccessMsg(null), 3000)
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (transfers.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Transfer Masuk</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Barang dalam perjalanan ke cabang ini</p>
        </div>
        <div className="text-center py-16 text-muted-foreground text-sm">
          Tidak ada transfer yang sedang dalam perjalanan ke cabang ini.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Transfer Masuk</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {transfers.length} transfer sedang dalam perjalanan ke cabang ini
        </p>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
          {successMsg}
        </div>
      )}

      <div className="space-y-3">
        {transfers.map((transfer) => {
          const isReceiving = receivingId === transfer.id
          const date = formatWIB(transfer.createdAt, {
            day: 'numeric', month: 'short', year: 'numeric',
          })

          return (
            <div key={transfer.id} className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm text-foreground">
                      {transfer.ibtNumber}
                    </span>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                      Dalam Perjalanan
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Dari: <span className="font-medium">{transfer.sourceBranchName ?? '-'}</span>
                    {' · '}{date}
                  </p>
                  {transfer.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{transfer.notes}</p>
                  )}
                </div>
                {!isReceiving && (
                  <button
                    onClick={() => openReceive(transfer)}
                    className="flex-shrink-0 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors"
                  >
                    Terima Barang
                  </button>
                )}
              </div>

              {/* Item list (always visible) */}
              <div className="border-t border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Produk</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Dikirim</th>
                      {isReceiving && (
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground w-28">Qty Terima</th>
                      )}
                      {isReceiving && (
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Alasan Selisih</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transfer.items.map((item) => {
                      const qtyTerima = receiveQty[item.id] ?? 0
                      const melebihiKirim = isReceiving && qtyTerima > item.qtyShipped
                      const kurang = isReceiving && qtyTerima < item.qtyShipped
                      const notesVal = receiveNotes[item.id] ?? ''

                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-sm">{item.productName ?? '-'}</div>
                            <div className="text-xs text-muted-foreground font-mono">{item.productSku ?? '-'}</div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">
                            {item.qtyShipped} {item.uomCode}
                          </td>
                          {isReceiving && (
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={item.qtyShipped}
                                  value={qtyTerima}
                                  onChange={(e) =>
                                    setReceiveQty((prev) => ({
                                      ...prev,
                                      [item.id]: Math.max(0, parseInt(e.target.value) || 0),
                                    }))
                                  }
                                  className={`w-16 text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 ${
                                    melebihiKirim
                                      ? 'border-red-400 focus:ring-red-400'
                                      : 'border-border focus:ring-green-400'
                                  }`}
                                />
                                <span className="text-xs text-muted-foreground">{item.uomCode}</span>
                              </div>
                              {melebihiKirim && (
                                <p className="text-xs text-red-600 mt-0.5 text-right">maks {item.qtyShipped}</p>
                              )}
                              {!melebihiKirim && kurang && (
                                <p className="text-xs text-orange-500 mt-0.5 text-right">
                                  -{item.qtyShipped - qtyTerima} selisih
                                </p>
                              )}
                            </td>
                          )}
                          {isReceiving && (
                            <td className="px-4 py-2.5">
                              {kurang ? (
                                <input
                                  type="text"
                                  value={notesVal}
                                  onChange={(e) =>
                                    setReceiveNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                                  }
                                  placeholder="Wajib diisi..."
                                  className={`w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 ${
                                    !notesVal.trim() ? 'border-orange-400' : 'border-border'
                                  }`}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {isReceiving && (
                <div className="px-4 py-3 border-t border-border bg-muted/20 space-y-2">
                  {errorMsg && (
                    <p className="text-xs text-destructive">{errorMsg}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReceive(transfer.id, transfer.items)}
                      disabled={loading}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Memproses...' : 'Konfirmasi Diterima'}
                    </button>
                    <button
                      onClick={closeReceive}
                      disabled={loading}
                      className="px-4 py-2 border border-border text-sm font-medium rounded-md hover:bg-accent disabled:opacity-50 transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
