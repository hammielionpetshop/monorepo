import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { branches, db, eq, paymentMethods } from '@/lib/db'
import BulkSaleClient from './_components/bulk-sale-client'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['OWNER', 'GM', 'MANAGER']
const GLOBAL_ROLES = ['OWNER', 'GM']

export default async function BulkSalePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload) redirect('/login')

  if (!ALLOWED_ROLES.includes(payload.role)) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya Owner, GM, dan Manager yang dapat membuat bulk sale.
          </p>
        </div>
      </div>
    )
  }

  // Kop struk dibawa per cabang, bukan satu untuk semua: OWNER/GM boleh memilih cabang
  // mana pun di sini, jadi identitas di struk harus ikut cabang yang dipilih.
  const branchColumns = {
    id: branches.id,
    name: branches.name,
    code: branches.code,
    receiptName: branches.receiptName,
    address: branches.address,
    phone: branches.phone,
  }

  const isGlobalRole = GLOBAL_ROLES.includes(payload.role)
  const branchRows = isGlobalRole
    ? await db
        .select(branchColumns)
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(branches.name)
    : await db.select(branchColumns).from(branches).where(eq(branches.id, payload.branchId)).limit(1)

  // Sebelumnya baris cabang untuk role non-global dirakit dari JWT tanpa menyentuh DB, jadi
  // selalu ada isinya. Sekarang datanya dari DB — jaga agar dropdown tidak pernah kosong.
  const branchOptions =
    branchRows.length > 0
      ? branchRows
      : [
          {
            id: payload.branchId,
            name: payload.branchName,
            code: String(payload.branchId),
            receiptName: 'HAMMIELION',
            address: null,
            phone: null,
          },
        ]

  const paymentMethodRows = await db
    .select({ id: paymentMethods.id, name: paymentMethods.name, type: paymentMethods.type })
    .from(paymentMethods)
    .orderBy(paymentMethods.name)

  return (
    <div className="p-6">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Memuat...</div>}>
        <BulkSaleClient
          currentUser={{
            userId: payload.userId,
            userName: payload.userName,
            branchId: payload.branchId,
            branchName: payload.branchName,
            role: payload.role,
          }}
          branches={branchOptions}
          paymentMethods={paymentMethodRows}
        />
      </Suspense>
    </div>
  )
}
