'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatWIB } from '@petshop/shared'
import type { SOListItem } from '../page'

interface Props {
  initialData: SOListItem[]
}

function formatDate(value: Date | string | undefined): string {
  return formatWIB(value)
}

export default function SOClient({ initialData }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<SOListItem[]>(initialData)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const approveAbortRef = useRef<AbortController | null>(null)
  const rejectAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setItems(initialData)
  }, [initialData])

  async function handleApprove(id: number) {
    if (!window.confirm('Setujui SO ini? Stok akan diperbarui.')) return

    setProcessingId(id)
    setErrorMsg(null)
    setSuccessMsg(null)

    approveAbortRef.current?.abort()
    const controller = new AbortController()
    approveAbortRef.current = controller

    try {
      const res = await fetch(`/api/bo/stock-opnames/${id}/approve`, {
        method: 'PATCH',
        signal: controller.signal,
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal menyetujui stock opname (${res.status})`)
        return
      }

      setSuccessMsg('Stock opname berhasil disetujui dan stok telah diperbarui')
      setItems((prev) => prev.filter((so) => so.id !== id))
      router.refresh()
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setProcessingId(null)
      if (approveAbortRef.current === controller) approveAbortRef.current = null
    }
  }

  async function handleReject(id: number) {
    if (!rejectReason.trim()) {
      setErrorMsg('Alasan penolakan wajib diisi')
      return
    }

    setProcessingId(id)
    setErrorMsg(null)
    setSuccessMsg(null)

    rejectAbortRef.current?.abort()
    const controller = new AbortController()
    rejectAbortRef.current = controller

    try {
      const res = await fetch(`/api/bo/stock-opnames/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
        signal: controller.signal,
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal menolak stock opname (${res.status})`)
        return
      }

      setSuccessMsg('Stock opname berhasil ditolak')
      setItems((prev) => prev.filter((so) => so.id !== id))
      setRejectingId(null)
      setRejectReason('')
      router.refresh()
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setProcessingId(null)
      if (rejectAbortRef.current === controller) rejectAbortRef.current = null
    }
  }

  return (
    <div>
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm mb-4">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm mb-4">
          {successMsg}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada stock opname yang menunggu persetujuan.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-md">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">No. SO</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tipe</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Cabang</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Petugas</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tanggal</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Jml Item</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((so) => (
                <tr key={so.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs">{so.soNumber}</td>
                  <td className="px-4 py-2">{so.type}</td>
                  <td className="px-4 py-2">{so.branchName}</td>
                  <td className="px-4 py-2">{so.createdByName}</td>
                  <td className="px-4 py-2 text-xs">{formatDate(so.createdAt)}</td>
                  <td className="px-4 py-2 text-right">{so.itemCount}</td>
                  <td className="px-4 py-2 text-center space-x-2">
                    {rejectingId === so.id ? null : (
                      <>
                        <button
                          onClick={() => handleApprove(so.id)}
                          disabled={processingId !== null || rejectingId !== null}
                          className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {processingId === so.id ? 'Memproses...' : 'Setujui'}
                        </button>
                        <button
                          onClick={() => {
                            setRejectingId(so.id)
                            setRejectReason('')
                            setErrorMsg(null)
                          }}
                          disabled={processingId !== null}
                          className="px-3 py-1 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Tolak
                        </button>
                      </>
                    )}
                    {rejectingId === so.id && (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Alasan penolakan (wajib)"
                          rows={2}
                          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReject(so.id)}
                            disabled={processingId !== null || !rejectReason.trim()}
                            className="px-3 py-1 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {processingId === so.id ? 'Memproses...' : 'Kirim Penolakan'}
                          </button>
                          <button
                            onClick={() => {
                              setRejectingId(null)
                              setRejectReason('')
                            }}
                            disabled={processingId !== null}
                            className="px-3 py-1 text-xs font-medium border border-border rounded-md hover:bg-accent transition-colors"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
