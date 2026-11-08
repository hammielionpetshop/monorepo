import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { hasPermission } from '@/lib/authz'
import CashDepositClient from './_components/cash-deposit-client'

export const dynamic = 'force-dynamic'

/** POS › Setor Tunai (F2-2): hanya untuk setor tunai ke bank. Uang yang diantar ke kantor dicatat Finance. */
export default async function CashDepositsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null
  if (!payload) redirect('/pos/login')

  if (!hasPermission(payload, 'deposit.report')) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Anda tidak punya akses untuk melaporkan setoran tunai. Bila baru saja diberi akses, keluar lalu masuk lagi.
      </div>
    )
  }
  return <CashDepositClient />
}
