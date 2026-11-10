import Link from 'next/link'

/**
 * Tanda untuk admin penerima (spec 2026-11-10 periksa harga jual): barang dari dokumen ini yang
 * modalnya naik masih menunggu manajemen memeriksa harga jualnya. Owner/GM mendapat tautan.
 */
export default function PriceReviewNotice({ count, canReview }: { count: number; canReview: boolean }) {
  if (count <= 0) return null
  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
      <b>{count} barang</b> dari dokumen ini modalnya naik — harga jualnya menunggu diperiksa manajemen. Selama belum
      diperiksa, kasir menolak harga yang di bawah modal.
      {canReview && (
        <>
          {' '}
          <Link href="/master-data/cost-review" className="font-medium text-primary hover:underline">
            Periksa harga jual →
          </Link>
        </>
      )}
    </div>
  )
}
