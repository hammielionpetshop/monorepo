'use client'

import { useCallback, useEffect, useState } from 'react'
import { Undo2 } from 'lucide-react'
import { SupplierReturnForm } from '@/components/supplier-returns/supplier-return-form'
import { SupplierReturnList } from '@/components/supplier-returns/supplier-return-list'
import type { SupplierReturnView } from '@/components/supplier-returns/types'

export default function ReturSupplierClient({ branchId }: { branchId: number }) {
  const [history, setHistory] = useState<SupplierReturnView[]>([])
  const [success, setSuccess] = useState('')

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/pos/supplier-returns')
      if (!res.ok) return
      const data = await res.json()
      setHistory(Array.isArray(data.data) ? data.data : [])
    } catch {
      // abaikan — riwayat bersifat informatif
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  return (
    <div className="mx-auto w-full max-w-3xl p-4 space-y-5">
      <div className="flex items-center gap-2">
        <Undo2 className="h-5 w-5 text-amber-600" aria-hidden="true" />
        <h1 className="text-lg font-bold text-foreground">Retur ke Supplier</h1>
      </div>

      <p className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
        Untuk barang yang <b>sudah diterima</b> lalu ketahuan rusak/expired dan dikembalikan ke supplier. Stok baru
        keluar dan tagihan supplier baru dipotong setelah disetujui Owner/GM. Barang rusak yang tidak dikembalikan ke
        supplier tetap dicatat di menu Barang Rusak.
      </p>

      {success && (
        <p className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
          {success}
        </p>
      )}

      <SupplierReturnForm
        apiBase="/api/pos/supplier-returns"
        branchId={branchId}
        onSubmitted={(returnNumber) => {
          setSuccess(`Retur ${returnNumber} diajukan — menunggu persetujuan Owner/GM.`)
          loadHistory()
        }}
      />

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold text-foreground">Riwayat Retur Cabang Ini</h2>
        <SupplierReturnList rows={history} printHref={(id) => `/pos/produk/retur-supplier/${id}/cetak`} />
      </div>
    </div>
  )
}
