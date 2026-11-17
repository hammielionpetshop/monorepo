'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { CostReviewEntry, CostReviewTab, MarginAlertEntry } from '@/lib/services/cost-sync-service'
import type { PriceReviewEntry } from '@/lib/services/price-review-service'

// Lembar cetak A4 Tinjau Modal & Margin untuk dibawa ke owner (cetak browser → kertas / Simpan PDF).
// Dirender lewat portal di <body>; saat mencetak, elemen lain di <body> disembunyikan supaya
// layout dashboard tidak ikut tercetak sebagai halaman kosong.

const PRINT_STYLES = `
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  body > *:not(.cr-print) { display: none !important; }
  .cr-print { display: block !important; }
}
.cr-print { display: none; color: #000; background: #fff; font-family: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 9.5pt; line-height: 1.35; }
.cr-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cr-print .head { display: flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
.cr-print h1 { font-size: 14pt; margin: 0; }
.cr-print .sub { color: #444; }
.cr-print .meta { text-align: right; color: #444; font-size: 8.5pt; }
.cr-print .filters { display: flex; flex-wrap: wrap; gap: 4px 16px; background: #f2f4f7; padding: 5px 8px; margin-bottom: 8px; }
.cr-print .filters span { color: #555; }
.cr-print .howto { font-size: 8.5pt; color: #333; border-left: 3px solid #bbb; padding-left: 6px; margin: 0 0 10px; }
.cr-print table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.cr-print th { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .04em; color: #444; font-weight: 600; text-align: right; padding: 3px 6px; border-bottom: 1px solid #999; vertical-align: bottom; }
.cr-print td { padding: 4px 6px; text-align: right; border-bottom: 1px dotted #bbb; vertical-align: top; }
.cr-print .l { text-align: left; }
.cr-print .c { text-align: center; }
.cr-print .g { border-left: 1px solid #bbb; }
.cr-print tr.grp th { text-align: center; color: #000; border-bottom: 0; padding-bottom: 0; }
.cr-print .b { font-weight: 700; }
.cr-print .loss { color: #b42318; font-weight: 600; }
.cr-print .muted { color: #555; font-size: 8pt; }
.cr-print .blank { min-width: 70px; }
.cr-print .blank::after { content: ""; display: block; border-bottom: 1px solid #555; height: 12px; }
.cr-print .item { border: 1px solid #999; margin-bottom: 8px; break-inside: avoid; page-break-inside: avoid; }
.cr-print .item-head { display: flex; justify-content: space-between; gap: 10px; padding: 4px 6px; background: #f2f4f7; border-bottom: 1px solid #999; }
.cr-print .item-head .name { font-weight: 700; }
.cr-print .item table tr:last-child td { border-bottom: 0; }
.cr-print .decide { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; padding: 4px 6px; border-top: 1px solid #999; }
.cr-print .box { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.cr-print .box i { width: 9px; height: 9px; border: 1.2px solid #000; display: inline-block; }
.cr-print .paraf { margin-left: auto; display: inline-flex; gap: 4px; align-items: flex-end; }
.cr-print .paraf b { width: 60px; border-bottom: 1px solid #555; height: 11px; display: inline-block; font-weight: 400; }
.cr-print tbody tr { break-inside: avoid; page-break-inside: avoid; }
.cr-print .sign { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; text-align: center; margin-top: 24px; break-inside: avoid; page-break-inside: avoid; }
.cr-print .sign div { display: grid; gap: 40px; }
.cr-print .sign b { border-top: 1px solid #000; padding-top: 2px; font-weight: 500; }
.cr-print .foot { margin-top: 10px; border-top: 1px solid #bbb; padding-top: 4px; font-size: 8pt; color: #555; }
`

export interface PrintFilter {
  label: string
  value: string
}

const TIER_LABELS: Record<string, string> = {
  RETAIL: 'Retail',
  RESELLER: 'Reseller',
  GROSIR: 'Grosir',
  MEMBER: 'Member',
  DISTRIBUTOR: 'Distributor',
  PROMO: 'Promo',
}

export const SOURCE_LABELS: Record<string, string> = {
  PO_RECEIVING: 'Terima PO',
  PO_INVOICE: 'Faktur PO',
  IBT_RECEIVE: 'Terima transfer internal',
  STOCK_ADJUSTMENT: 'Penambahan stok',
  PO_REVERSAL: 'Batal terima PO',
}

const rupiah = (n: number | null) => (n === null ? '—' : n.toLocaleString('id-ID'))
const percent = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('id-ID')}%`

function formatDateTime(date: Date | string, withTime = true): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      ...(withTime ? { timeStyle: 'short' as const } : {}),
      timeZone: 'Asia/Jakarta',
    }).format(new Date(date))
  } catch {
    return String(date)
  }
}

/** Waktu cetak diisi saat tombol ditekan; lembar baru dipasang setelah itu lalu dialog cetak dibuka. */
export function usePrintSheet() {
  const [printedAt, setPrintedAt] = useState<Date | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!pending) return
    const timer = setTimeout(() => {
      setPending(false)
      window.print()
    }, 50)
    return () => clearTimeout(timer)
  }, [pending])

  const print = useCallback(() => {
    setPrintedAt(new Date())
    setPending(true)
  }, [])

  return { printedAt, print }
}

export function PrintButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
    >
      Cetak / PDF
    </button>
  )
}

function Sheet({
  title,
  printedAt,
  filters,
  howto,
  children,
  approval = true,
}: {
  title: string
  printedAt: Date
  filters: PrintFilter[]
  howto?: ReactNode
  children: ReactNode
  approval?: boolean
}) {
  return createPortal(
    <div className="cr-print">
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
      <div className="head">
        <div>
          <h1>{title}</h1>
          <div className="sub">Hammielion · Tinjau Modal &amp; Margin</div>
        </div>
        <div className="meta">
          <div>Dicetak {formatDateTime(printedAt)} WIB</div>
          {approval && <div>Angka berlaku per waktu cetak</div>}
        </div>
      </div>
      <div className="filters">
        {filters.map(f => (
          <div key={f.label}>
            <span>{f.label}:</span> <b>{f.value}</b>
          </div>
        ))}
      </div>
      {howto && <p className="howto">{howto}</p>}
      {children}
      {approval && (
        <>
          <div className="sign">
            <div><span>Disiapkan</span><b>Admin</b></div>
            <div><span>Disetujui</span><b>Owner</b></div>
            <div><span>Diinput ke sistem</span><b>Nama &amp; tanggal</b></div>
          </div>
          <div className="foot">Keputusan baru berlaku setelah diinput di Tinjau Modal &amp; Margin.</div>
        </>
      )}
    </div>,
    document.body,
  )
}

function Box({ children }: { children: ReactNode }) {
  return <span className="box"><i />{children}</span>
}

export function PriceReviewPrint({
  reviews,
  printedAt,
  filters,
}: {
  reviews: PriceReviewEntry[]
  printedAt: Date
  filters: PrintFilter[]
}) {
  return (
    <Sheet
      title="Lembar Persetujuan Harga Jual"
      printedAt={printedAt}
      filters={[...filters, { label: 'Jumlah barang', value: `${reviews.length} barang` }]}
      howto={
        <>
          <b>Harga jual usulan</b> = harga jual baru yang disarankan sistem supaya persentase untung tetap sama seperti
          sebelum modal naik (dibulatkan ke atas ke Rp 100). <b>Untung bila harga jual tidak naik</b> = untung yang tersisa
          kalau harga jual lama tetap dipakai dengan modal baru; merah berarti rugi. Centang satu keputusan per barang. Bila
          owner menentukan harga sendiri, tulis di kolom &quot;Harga ACC owner&quot;.
        </>
      }
    >
      {reviews.map((review, index) => (
        <section key={review.id} className="item">
          <div className="item-head">
            <div>
              <span className="name">{index + 1}. {review.productName}</span>
              {review.sku && <span className="muted"> · SKU {review.sku}</span>}
              <div className="muted">
                {review.branchName} ·{' '}
                {review.sources.map(s => `${SOURCE_LABELS[s.type] ?? s.type}${s.ref ? ` ${s.ref}` : ''}`).join(', ')} ·{' '}
                {formatDateTime(review.updatedAt, false)}
              </div>
            </div>
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              {review.changePercent !== null ? (
                <>Modal naik <span className="loss">{percent(review.changePercent)}</span></>
              ) : (
                'Modal baru'
              )}
              {review.costPending && <div className="muted">Modal baru masih ditahan, ikut disetujui bersama harga</div>}
            </div>
          </div>
          {review.lines.length === 0 ? (
            <p className="muted" style={{ padding: '4px 6px', margin: 0 }}>
              Belum ada harga jual di cabang ini. Modal per {review.baseUomCode ?? 'satuan dasar'}:{' '}
              {rupiah(review.oldCostPerBase)} → {rupiah(review.newCostPerBase)}.
            </p>
          ) : (
            <table>
              <thead>
                <tr className="grp">
                  <th /><th />
                  <th colSpan={2} className="g">Modal</th>
                  <th colSpan={2} className="g">Harga jual</th>
                  <th className="g" /><th className="g" />
                </tr>
                <tr>
                  <th className="l">Satuan</th>
                  <th className="l">Jenis harga</th>
                  <th className="g">Modal lama</th>
                  <th>Modal baru</th>
                  <th className="g">Harga jual lama</th>
                  <th>Harga jual usulan</th>
                  <th className="g">Untung bila harga jual tidak naik</th>
                  <th className="g">Harga ACC owner</th>
                </tr>
              </thead>
              <tbody>
                {review.lines.map(line => {
                  const loss = line.marginPercent !== null && line.marginPercent <= 0
                  return (
                    <tr key={`${line.uomId}:${line.tierType}`}>
                      <td className="l">{line.uomCode ?? '-'}</td>
                      <td className="l">{TIER_LABELS[line.tierType] ?? line.tierType}</td>
                      <td className="g">{rupiah(line.oldUnitCost)}</td>
                      <td className="b">{rupiah(line.unitCost)}</td>
                      <td className="g">{rupiah(line.price)}</td>
                      <td className="b">{rupiah(line.suggested)}</td>
                      <td className={`g ${loss ? 'loss' : ''}`}>
                        {line.marginPercent === null ? '—' : `${line.marginPercent.toLocaleString('id-ID')}%${loss ? ' (rugi)' : ''}`}
                      </td>
                      <td className="g blank" />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <div className="decide">
            <Box>ACC usulan</Box>
            <Box>Pakai harga ACC owner</Box>
            <Box>Pertahankan harga jual lama</Box>
            {review.costPending && <Box>Tolak kenaikan modal</Box>}
            <span className="paraf">Paraf <b /></span>
          </div>
        </section>
      ))}
    </Sheet>
  )
}

const COST_TAB_TITLES: Record<CostReviewTab, string> = {
  PENDING: 'Lembar Persetujuan Perubahan Modal',
  APPLIED: 'Riwayat Modal Diterapkan Otomatis',
  APPROVED: 'Riwayat Modal Disetujui',
  REJECTED: 'Riwayat Modal Ditolak / Digantikan',
}

export function CostReviewPrint({
  reviews,
  tab,
  printedAt,
  filters,
}: {
  reviews: CostReviewEntry[]
  tab: CostReviewTab
  printedAt: Date
  filters: PrintFilter[]
}) {
  const pending = tab === 'PENDING'
  return (
    <Sheet
      title={COST_TAB_TITLES[tab]}
      printedAt={printedAt}
      approval={pending}
      filters={[...filters, { label: 'Jumlah baris', value: `${reviews.length}` }]}
      howto={
        pending ? (
          <>
            Modal per satuan dasar yang naik/turun 30% atau lebih, atau kembali karena penerimaan PO dibatalkan, menunggu
            keputusan. <b>Setujui</b> = modal baru dipakai di Manajemen Harga untuk semua satuan barang itu.{' '}
            <b>Tolak</b> = modal tetap yang lama.
          </>
        ) : undefined
      }
    >
      <table>
        <thead>
          <tr className="grp">
            <th /><th /><th /><th />
            <th colSpan={2} className="g">Modal per satuan dasar</th>
            <th className="g" /><th className="g" />
          </tr>
          <tr>
            <th className="l">No</th>
            <th className="l">Produk</th>
            <th className="l">Cabang</th>
            <th className="l">Sumber</th>
            <th className="g">Modal lama</th>
            <th>Modal baru</th>
            <th className="g">Perubahan</th>
            <th className="g l">{pending ? 'Keputusan owner' : 'Keputusan'}</th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((r, index) => (
            <tr key={r.id}>
              <td className="l">{index + 1}</td>
              <td className="l">
                <div className="b">{r.productName}</div>
                {r.sku && <div className="muted">SKU {r.sku}</div>}
              </td>
              <td className="l">{r.branchName}</td>
              <td className="l">
                <div>{SOURCE_LABELS[r.sourceType] ?? r.sourceType}</div>
                <div className="muted">{r.sourceRef ?? '-'} · {formatDateTime(r.createdAt, false)}</div>
              </td>
              <td className="g">{rupiah(r.oldCostPerBase)} <span className="muted">/{r.baseUomCode ?? ''}</span></td>
              <td className="b">{rupiah(r.newCostPerBase)} <span className="muted">/{r.baseUomCode ?? ''}</span></td>
              <td className={`g ${r.changePercent !== null && Math.abs(r.changePercent) >= 30 ? 'b' : ''}`}>
                {r.changePercent === null ? 'modal baru' : percent(r.changePercent)}
              </td>
              <td className="g l">
                {pending ? (
                  <div style={{ display: 'grid', gap: 4 }}>
                    <Box>Setujui</Box>
                    <Box>Tolak</Box>
                    <span className="paraf" style={{ marginLeft: 0 }}>Paraf <b /></span>
                  </div>
                ) : (
                  <div className="muted">
                    {r.status === 'APPLIED' && 'Diterapkan otomatis'}
                    {r.status === 'APPROVED' && `Disetujui ${r.resolvedByName ?? '-'}`}
                    {r.status === 'REJECTED' && `Ditolak ${r.resolvedByName ?? '-'}`}
                    {r.status === 'SUPERSEDED' && 'Digantikan'}
                    {r.resolvedAt && ` · ${formatDateTime(r.resolvedAt, false)}`}
                    {r.resolutionNote && <div>&ldquo;{r.resolutionNote}&rdquo;</div>}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  )
}

export function MarginPrint({
  rows,
  total,
  printedAt,
  filters,
}: {
  rows: MarginAlertEntry[]
  total: number
  printedAt: Date
  filters: PrintFilter[]
}) {
  return (
    <Sheet
      title="Lembar Persetujuan Harga Jual — Margin Menipis / Rugi"
      printedAt={printedAt}
      filters={[
        ...filters,
        { label: 'Jumlah baris', value: total > rows.length ? `${rows.length} dari ${total} (margin terendah)` : `${rows.length}` },
      ]}
      howto={
        <>
          Harga jual yang untungnya 1% atau kurang dari modal saat ini. <b>Rugi</b> = harga jual sama atau di bawah modal.
          Tulis harga jual baru yang disetujui di kolom &quot;Harga jual baru (ACC owner)&quot;, atau centang
          &quot;Biarkan&quot; bila harga jual memang tidak diubah.
        </>
      }
    >
      <table>
        <thead>
          <tr>
            <th className="l">No</th>
            <th className="l">Produk</th>
            <th className="l">Cabang</th>
            <th className="l">Satuan</th>
            <th className="l">Jenis harga</th>
            <th className="g">Modal</th>
            <th>Harga jual</th>
            <th className="g">Untung</th>
            <th className="g">Harga jual baru (ACC owner)</th>
            <th className="c">Biarkan</th>
            <th className="c">Paraf</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m, index) => {
            const loss = m.margin <= 0
            return (
              <tr key={`${m.branchId}:${m.productId}:${m.uomId}:${m.tierType}`}>
                <td className="l">{index + 1}</td>
                <td className="l">
                  <div className="b">{m.productName}</div>
                  {m.sku && <div className="muted">SKU {m.sku}</div>}
                </td>
                <td className="l">{m.branchName}</td>
                <td className="l">{m.uomCode}</td>
                <td className="l">{TIER_LABELS[m.tierType] ?? m.tierType}</td>
                <td className="g">{rupiah(m.costPrice)}</td>
                <td>{rupiah(m.price)}</td>
                <td className={`g ${loss ? 'loss' : ''}`}>
                  {rupiah(m.margin)} ({m.marginPercent.toLocaleString('id-ID')}%){loss ? ' rugi' : ''}
                </td>
                <td className="g blank" />
                <td className="c"><span className="box"><i /></span></td>
                <td className="blank" />
              </tr>
            )
          })}
        </tbody>
      </table>
    </Sheet>
  )
}
