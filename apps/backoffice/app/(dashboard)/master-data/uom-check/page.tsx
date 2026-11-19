import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatWIB } from '@petshop/shared'
import { getAuth } from '@/lib/authz'
import { NewBadge } from '@/components/ui/new-badge'
import { getUomMismatchReport, UOM_MISMATCH_LIMIT } from '@/lib/services/uom-mismatch-report'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['OWNER', 'GM', 'MANAGER']

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const when = (iso: string) =>
  formatWIB(iso, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function ProductCell({ productId, productName, uomName, baseUomName }: {
  productId: number
  productName: string
  uomName: string | null
  baseUomName: string | null
}) {
  return (
    <>
      <td className="px-3 py-2 text-xs">
        <Link href={`/master-data/products/${productId}`} className="text-primary hover:underline">
          {productName}
        </Link>
      </td>
      <td className="px-3 py-2 text-xs font-medium text-destructive">{uomName ?? '-'}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{baseUomName ?? '-'}</td>
    </>
  )
}

const th = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground'

export default async function UomCheckPage() {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  if (!ALLOWED_ROLES.includes(payload.role)) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya Owner, GM, dan Manager yang dapat membuka Pemeriksaan Satuan.
          </p>
        </div>
      </div>
    )
  }

  const report = await getUomMismatchReport()

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Pemeriksaan Satuan <NewBadge feature="/master-data/uom-check" />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Baris transaksi dan PO Internal yang satuannya tidak ada di master produk (bukan satuan dasar dan tidak
          ada di daftar satuan produk). Baris seperti ini bisa berharga Rp0 atau memotong stok dengan isi yang salah.
          Cek <strong>Riwayat Satuan</strong> di detail produk untuk melihat kapan satuannya diubah; perbaiki
          dokumennya lewat koreksi, bukan diedit langsung.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`rounded-lg border p-4 ${report.transactionTotal > 0 ? 'border-destructive bg-destructive/5' : 'border-border'}`}>
          <p className="text-xs text-muted-foreground">Baris transaksi bermasalah</p>
          <p className="text-2xl font-bold text-foreground">{report.transactionTotal.toLocaleString('id-ID')}</p>
        </div>
        <div className={`rounded-lg border p-4 ${report.transferTotal > 0 ? 'border-destructive bg-destructive/5' : 'border-border'}`}>
          <p className="text-xs text-muted-foreground">Baris PO Internal bermasalah</p>
          <p className="text-2xl font-bold text-foreground">{report.transferTotal.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Transaksi</h2>
        {report.transactionTotal > UOM_MISMATCH_LIMIT && (
          <p className="text-xs text-muted-foreground">Menampilkan {UOM_MISMATCH_LIMIT} baris terbaru.</p>
        )}
        {report.transactions.length === 0 ? (
          <p className="rounded-md border border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Tidak ada baris transaksi bermasalah.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className={th}>Waktu</th>
                  <th className={th}>No. Transaksi</th>
                  <th className={th}>Cabang</th>
                  <th className={th}>Produk</th>
                  <th className={th}>Satuan tercatat</th>
                  <th className={th}>Satuan dasar</th>
                  <th className={`${th} text-right`}>Qty</th>
                  <th className={`${th} text-right`}>Harga</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {report.transactions.map((r) => (
                  <tr key={r.itemId} className="border-t border-border">
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{when(r.createdAt)}</td>
                    <td className="px-3 py-2 text-xs">
                      <Link href={`/transactions?q=${encodeURIComponent(r.trxNumber)}`} className="text-primary hover:underline">
                        {r.trxNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">{r.branchName ?? '-'}</td>
                    <ProductCell {...r} />
                    <td className="px-3 py-2 text-xs text-right">{r.qty.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2 text-xs text-right">{rupiah(r.unitPrice)}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.status}
                      {r.isRemoved ? ' (baris dihapus)' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">PO Internal</h2>
        {report.transferTotal > UOM_MISMATCH_LIMIT && (
          <p className="text-xs text-muted-foreground">Menampilkan {UOM_MISMATCH_LIMIT} baris terbaru.</p>
        )}
        {report.transfers.length === 0 ? (
          <p className="rounded-md border border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Tidak ada baris PO Internal bermasalah.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className={th}>Waktu</th>
                  <th className={th}>No. PO Internal</th>
                  <th className={th}>Pengirim → Tujuan</th>
                  <th className={th}>Produk</th>
                  <th className={th}>Satuan tercatat</th>
                  <th className={th}>Satuan dasar</th>
                  <th className={`${th} text-right`}>Qty</th>
                  <th className={`${th} text-right`}>Modal</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {report.transfers.map((r) => (
                  <tr key={r.itemId} className="border-t border-border">
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{when(r.createdAt)}</td>
                    <td className="px-3 py-2 text-xs">
                      <Link href={`/purchase-orders/internal/${r.transferId}`} className="text-primary hover:underline">
                        {r.ibtNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.sourceBranchName ?? '-'} → {r.destinationBranchName ?? '-'}
                    </td>
                    <ProductCell {...r} />
                    <td className="px-3 py-2 text-xs text-right">{r.qtyRequested.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2 text-xs text-right">{rupiah(r.costPriceAtTransfer)}</td>
                    <td className="px-3 py-2 text-xs">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
