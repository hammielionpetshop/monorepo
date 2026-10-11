'use client'

import { Printer } from 'lucide-react'
import { STATUS_BADGE, formatDateTimeWib, formatRupiah } from '@/components/supplier-returns/types'
import {
  INTERNAL_KIND_LABELS,
  INTERNAL_REASON_LABELS,
  INTERNAL_STATUS_LABELS,
  isPriceRevision,
  revisionValueLabel,
  type InternalReturnView,
} from './types'
import { InternalReturnActions, type InternalReturnActionsConfig } from './internal-return-actions'

/** Nilai dokumen untuk ditampilkan: nilai retur, atau arah perubahan tagihan untuk Revisi Harga Beli. */
export function internalReturnValueText(row: InternalReturnView): string {
  const prefix = row.status === 'PENDING' ? '~' : ''
  return isPriceRevision(row) ? `Tagihan ${prefix}${revisionValueLabel(row.totalValue)}` : `${prefix}${formatRupiah(row.totalValue)}`
}

/** Siapa ke siapa: barang kembali ke pengirim, atau (Revisi Harga Beli) kiriman yang harganya dibetulkan. */
export function internalReturnRouteText(row: InternalReturnView): string {
  return isPriceRevision(row)
    ? `${row.receiverBranchName} · harga kiriman dari ${row.senderBranchName}`
    : `${row.receiverBranchName} → kembali ke ${row.senderBranchName}`
}

/**
 * Ringkasan hasil dokumen yang disetujui: berapa memotong hutang internal, berapa jadi Saldo
 * Internal; untuk Revisi Harga Beli juga kenaikan tagihan dan Penyesuaian Modal.
 */
export function InternalReturnOutcome({ row }: { row: InternalReturnView }) {
  if (row.status !== 'APPROVED' && row.status !== 'CANCELLED') return null
  const parts: string[] = []
  if (row.payableDeduction > 0) parts.push(`Hutang internal ${row.ibtNumber} dipotong ${formatRupiah(row.payableDeduction)}`)
  if (row.payableDeduction < 0) parts.push(`Tagihan internal ${row.ibtNumber} bertambah ${formatRupiah(-row.payableDeduction)}`)
  if (row.creditAmount > 0) parts.push(`Masuk Saldo Internal ${formatRupiah(row.creditAmount)}`)
  if (isPriceRevision(row) && row.cogsAdjustment !== 0)
    parts.push(`Modal barang yang sudah terjual dikoreksi ${revisionValueLabel(row.cogsAdjustment)}`)
  if (parts.length === 0) return null
  return (
    <p className={`text-xs ${row.status === 'CANCELLED' ? 'text-muted-foreground line-through' : 'text-emerald-700 dark:text-emerald-400'}`}>
      {parts.join(' · ')}
    </p>
  )
}

export function InternalReturnItems({ row }: { row: InternalReturnView }) {
  if (isPriceRevision(row)) {
    return (
      <ul className="mt-1.5 space-y-1">
        {row.items.map(it => {
          const newPrice = it.finalUnitPrice ?? it.proposedUnitPrice
          return (
            <li key={it.id} className="flex items-center justify-between gap-3 text-sm text-foreground">
              <span className="min-w-0">
                <span className="block truncate">{it.qty} {it.uomCode} · {it.productName}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatRupiah(it.unitPrice)} → <b className="text-foreground">{newPrice == null ? '-' : formatRupiah(newPrice)}</b>/{it.uomCode}
                  {it.finalUnitPrice == null
                    ? ' (usulan)'
                    : it.proposedUnitPrice != null && it.proposedUnitPrice !== it.finalUnitPrice
                      ? ` (usulan pemohon ${formatRupiah(it.proposedUnitPrice)})`
                      : ''}
                </span>
              </span>
              <span className="flex-shrink-0 tabular-nums text-muted-foreground">{revisionValueLabel(it.lineValue)}</span>
            </li>
          )
        })}
      </ul>
    )
  }
  return (
    <ul className="mt-1.5 space-y-1">
      {row.items.map(it => (
        <li key={it.id} className="flex items-center justify-between gap-3 text-sm text-foreground">
          <span className="flex items-center gap-2 min-w-0">
            {it.photoUrl && (
              <a href={it.photoUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.photoUrl} alt="" className="h-7 w-7 rounded object-cover border border-border" />
              </a>
            )}
            <span className="truncate">{it.qty} {it.uomCode} · {it.productName}</span>
          </span>
          <span className="flex-shrink-0 tabular-nums text-muted-foreground">{formatRupiah(it.lineValue)}</span>
        </li>
      ))}
    </ul>
  )
}

export function InternalReturnList({
  rows,
  printHref,
  emptyText = 'Belum ada pengajuan retur internal',
  actions,
}: {
  rows: InternalReturnView[]
  /** Link halaman cetak dokumen; tidak diisi = tanpa tombol cetak. */
  printHref?: (id: number) => string
  emptyText?: string
  /** Tombol Tarik (pengaju) & Batalkan (OWNER/GM); tidak diisi = tanpa tombol. */
  actions?: InternalReturnActionsConfig
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
  }
  return (
    <ul className="divide-y divide-border">
      {rows.map(row => (
        <li key={row.id} className="py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_BADGE[row.status]}`}>
                  {INTERNAL_STATUS_LABELS[row.status]}
                </span>
                <span className="font-mono text-xs font-semibold text-foreground">{row.returnNumber}</span>
                <span className="text-xs text-muted-foreground">
                  {INTERNAL_KIND_LABELS[row.kind] ?? row.kind} · {row.ibtNumber} · {INTERNAL_REASON_LABELS[row.reason] ?? row.reason}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {internalReturnRouteText(row)} · {formatDateTimeWib(row.requestedAt)} · {row.requestedByName}
              </p>
              <InternalReturnItems row={row} />
              <p className="mt-1 text-xs italic text-muted-foreground">{row.notes}</p>
              <InternalReturnOutcome row={row} />
              {row.status === 'REJECTED' && row.rejectionReason && (
                <p className="mt-1 text-xs text-destructive">Ditolak: {row.rejectionReason}</p>
              )}
              {row.status === 'WITHDRAWN' && row.resolvedAt && (
                <p className="mt-1 text-xs text-muted-foreground">Ditarik pengaju · {formatDateTimeWib(row.resolvedAt)}</p>
              )}
              {row.status === 'CANCELLED' && (
                <p className="mt-1 text-xs text-destructive">
                  Dibatalkan{row.cancelledByName ? ` oleh ${row.cancelledByName}` : ''}
                  {row.cancelledAt ? ` · ${formatDateTimeWib(row.cancelledAt)}` : ''}: {row.cancellationReason}
                  {' '}— {isPriceRevision(row) ? 'modal stok, tagihan' : 'stok, potongan hutang'} &amp; saldo internal sudah dibalik.
                </p>
              )}
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-2">
              <span className="text-sm font-bold text-foreground">
                {internalReturnValueText(row)}
              </span>
              {printHref && (
                <a
                  href={printHref(row.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-accent"
                >
                  <Printer className="h-3.5 w-3.5" /> Cetak
                </a>
              )}
              {actions && <InternalReturnActions row={row} config={actions} />}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
