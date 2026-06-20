import { db, suppliers } from '@/lib/db'
import SupplierClient from './_components/supplier-client'
import type { Supplier } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function SuppliersPage() {
  let data: Supplier[] = []
  let error: string | null = null

  try {
    data = await db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        phone: suppliers.phone,
        email: suppliers.email,
        contactPerson: suppliers.contactPerson,
        bankAccount: suppliers.bankAccount,
        address: suppliers.address,
        paymentTermDays: suppliers.paymentTermDays,
      })
      .from(suppliers)
      .orderBy(suppliers.name)
  } catch (e) {
    console.error('SuppliersPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data supplier'
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
        <h1 className="text-xl font-semibold text-foreground">Manajemen Supplier</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola daftar supplier untuk kebutuhan pembelian</p>
      </div>
      <SupplierClient suppliers={data} />
    </div>
  )
}
