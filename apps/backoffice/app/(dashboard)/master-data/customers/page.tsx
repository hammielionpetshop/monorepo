import { db, customers } from '@/lib/db'
import CustomerClient from './_components/customer-client'
import type { Customer } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  let data: Customer[] = []
  let error: string | null = null

  try {
    data = await db
      .select({
        id: customers.id,
        code: customers.code,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        isActive: customers.isActive,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .orderBy(customers.name)
  } catch (e) {
    console.error('CustomersPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data customer'
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
        <h1 className="text-xl font-semibold text-foreground">Manajemen Customer</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola daftar customer</p>
      </div>
      <CustomerClient customers={data} />
    </div>
  )
}
