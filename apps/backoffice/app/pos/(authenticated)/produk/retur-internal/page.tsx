import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowLeft, ArrowLeftRight } from 'lucide-react'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { InternalReturnsPanel } from '@/components/internal-returns/internal-returns-panel'

export const dynamic = 'force-dynamic'

export default async function ReturInternalPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value

  let payload: Awaited<ReturnType<typeof verifyAccessTokenCached>> | null = null
  try {
    payload = token ? await verifyAccessTokenCached(token) : null
  } catch {
    redirect('/pos/login')
  }

  if (!payload) {
    redirect('/pos/login')
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-4 space-y-5">
      <Link href="/pos/produk/retur" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Pilihan retur
      </Link>

      <div className="flex items-center gap-2">
        <ArrowLeftRight className="h-5 w-5 text-primary" aria-hidden="true" />
        <h1 className="text-lg font-bold text-foreground">Retur Internal</h1>
      </div>

      <p className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
        Untuk barang kiriman cabang sendiri (Gudang atau toko lain) yang <b>sudah dicatat diterima</b>. Siapkan nomor
        transfer (IBT) atau nomor nota-nya. Stok dan hutang internal baru berubah setelah disetujui Owner/GM.
      </p>

      {/* Pembatalan retur yang sudah disetujui dilakukan Owner/GM dari Back Office. */}
      <InternalReturnsPanel
        apiBase="/api/pos/internal-returns"
        printBase="/pos/produk/retur-internal"
        userId={payload.userId}
        canCancel={false}
        historyTitle="Riwayat Retur Internal Cabang Ini"
      />
    </div>
  )
}
