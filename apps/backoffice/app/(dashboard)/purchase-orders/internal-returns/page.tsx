import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getAuth, hasPermission } from '@/lib/authz'
import { InternalReturnsPanel } from '@/components/internal-returns/internal-returns-panel'

export const dynamic = 'force-dynamic'

export default async function InternalReturnsPage() {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  const allBranches = payload.branchScope === 'ALL'

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <Link href="/purchase-orders/retur" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Pilihan retur
        </Link>
        <h1 className="text-xl font-semibold text-foreground">Retur Internal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Untuk kiriman antar cabang (Gudang → toko, atau toko → toko) yang sudah diterima. Wajib memakai kode transaksi
          asal. Pengajuan disetujui Owner/GM di Permintaan Persetujuan — saat itu stok kembali ke cabang pengirim
          (Barang Dikembalikan) atau harga kirimannya dibetulkan tanpa menggeser stok (Revisi Harga Beli), dan hutang
          internal menyesuaikan; kelebihannya jadi Saldo Internal.
          {!allBranches && (
            <> Anda bisa mengajukan untuk kiriman dari / ke cabang <b>{payload.branchName}</b>.</>
          )}
        </p>
      </div>
      <InternalReturnsPanel
        apiBase="/api/bo/internal-returns"
        printBase="/purchase-orders/internal-returns"
        userId={payload.userId}
        canCancel={hasPermission(payload, 'void.approve')}
        historyTitle={allBranches ? 'Daftar Retur Internal (semua cabang)' : 'Daftar Retur Internal Cabang Ini'}
      />
    </div>
  )
}
