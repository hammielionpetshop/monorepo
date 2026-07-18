import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getAuth, hasPermission } from '@/lib/authz'
import { getStockOpnameDetail } from '@/lib/services/stock-opname-report'
import SODetailItems from '../_components/so-detail-items'
import { METHOD_LABELS, STATUS_LABELS, TYPE_LABELS, formatDateTime } from '../_components/format'

export const dynamic = 'force-dynamic'

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="p-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

export default async function StockOpnameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  if (!hasPermission(payload, 'stock_opname.read')) {
    return <AccessDenied message="Anda tidak memiliki akses untuk melihat laporan stock opname." />
  }

  const { id } = await params
  const soId = Number(id)
  if (!Number.isInteger(soId) || soId <= 0) notFound()

  const detail = await getStockOpnameDetail(soId)
  if (!detail) notFound()

  const { header, items } = detail

  if (payload.branchScope !== 'ALL' && header.branchId !== payload.branchId) {
    return <AccessDenied message="Anda hanya dapat melihat stock opname cabang sendiri." />
  }

  const isApproved = header.status === 'APPROVED'
  const mismatchCount = items.filter((i) => i.varianceQty !== 0).length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link
        href="/reports/stock-opname"
        className="text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        &larr; Kembali ke laporan
      </Link>

      <div className="mt-3 mb-6">
        <h1 className="text-2xl font-bold text-foreground">{header.soNumber}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {header.branchName} · {TYPE_LABELS[header.type] ?? header.type}
          {header.method ? ` — ${METHOD_LABELS[header.method] ?? header.method}` : ''} ·{' '}
          {STATUS_LABELS[header.status] ?? header.status}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-sm">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Dihitung Oleh</p>
          <p className="text-foreground mt-1">{header.createdByName}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(header.createdAt)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Diputuskan Oleh</p>
          <p className="text-foreground mt-1">{header.decidedByName ?? '—'}</p>
          <p className="text-xs text-muted-foreground">
            {header.completedAt ? formatDateTime(header.completedAt) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Item Dihitung</p>
          <p className="text-foreground mt-1">{items.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tidak Match</p>
          <p className="text-foreground mt-1">{mismatchCount}</p>
        </div>
      </div>

      {!isApproved && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200 rounded-md text-sm">
          SO ini berstatus <span className="font-semibold">{STATUS_LABELS[header.status] ?? header.status}</span> —
          hitungannya tercatat tapi <span className="font-semibold">tidak mengubah stok</span>, jadi nilai selisihnya
          tidak disertakan.
          {header.rejectionNote && <span className="block mt-1">Alasan: {header.rejectionNote}</span>}
        </div>
      )}

      {header.notes && (
        <div className="mb-6 p-4 bg-muted/40 border border-border rounded-md text-sm text-foreground">
          <span className="font-medium">Catatan:</span> {header.notes}
        </div>
      )}

      <SODetailItems items={items} soId={header.id} isApproved={isApproved} />
    </div>
  )
}
