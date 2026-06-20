import { db, paymentMethods } from '@/lib/db'
import PaymentMethodClient from './_components/payment-method-client'
import type { PaymentMethod } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function PaymentMethodsPage() {
  let data: PaymentMethod[] = []
  let error: string | null = null

  try {
    data = (await db
      .select({
        id: paymentMethods.id,
        name: paymentMethods.name,
        type: paymentMethods.type,
      })
      .from(paymentMethods)
      .orderBy(paymentMethods.name)) as PaymentMethod[]
  } catch (e) {
    console.error('PaymentMethodsPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data metode pembayaran'
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Manajemen Metode Pembayaran</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola daftar metode pembayaran yang tersedia di kasir</p>
      </div>
      <PaymentMethodClient paymentMethods={data} />
    </div>
  )
}
