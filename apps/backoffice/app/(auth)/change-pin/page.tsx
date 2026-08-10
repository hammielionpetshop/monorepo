import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/authz'
import { db, users, eq } from '@/lib/db'
import ChangePinForm from './_components/change-pin-form'

export const dynamic = 'force-dynamic'

export default async function ChangePinPage() {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  // User warisan tanpa `pin_hash` tidak punya PIN lama untuk diverifikasi — form harus
  // langsung menawarkan password sebagai gantinya, bukan menunggu user kena error dulu.
  const [user] = await db
    .select({ pinHash: users.pinHash, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1)

  return (
    <ChangePinForm
      role={payload.role}
      userName={payload.userName}
      forced={payload.mustChangePin === true}
      hasPin={Boolean(user?.pinHash)}
      hasPassword={Boolean(user?.passwordHash)}
    />
  )
}
