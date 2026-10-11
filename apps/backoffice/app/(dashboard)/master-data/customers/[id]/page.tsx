import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAuth, hasPermission } from '@/lib/authz'
import { db, customers, transactions, customerDebts, debtPayments, paymentMethods, eq, inArray, desc, asc } from '@/lib/db'
import CustomerDetailClient from './_components/customer-detail-client'
import { listPets, type PetRow } from '@/lib/services/grooming-master-service'
import { formatPetAge } from '@/lib/pet-age'
import { NewBadge } from '@/components/ui/new-badge'
import type { TransactionSummary, CustomerDebt, DebtPayment, PaymentMethod } from '../_components/types'

export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const customerId = Number(id)

  // Gate UI memakai permission yang sama dengan yang diperiksa API-nya, supaya tombol
  // yang muncul tidak berakhir 403 saat ditekan.
  const payload = await getAuth()
  const canVoidPayment = payload ? hasPermission(payload, 'debt.payment_void') : false

  const customerResult = await db
    .select({
      id: customers.id,
      code: customers.code,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      address: customers.address,
      defaultTierType: customers.defaultTierType,
      isActive: customers.isActive,
      canOrderOnline: customers.canOrderOnline,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1)

  if (customerResult.length === 0) notFound()

  const customer = customerResult[0]

  let trxData: TransactionSummary[] = []
  let debtData: CustomerDebt[] = []
  let pmData: PaymentMethod[] = []
  let error: string | null = null

  try {
    trxData = await db
      .select({
        id: transactions.id,
        trxNumber: transactions.trxNumber,
        totalAmount: transactions.totalAmount,
        payableAmount: transactions.payableAmount,
        status: transactions.status,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(eq(transactions.customerId, customerId))
      .orderBy(desc(transactions.createdAt))
      .limit(200)
  } catch (e) {
    console.error('CustomerDetailPage trx error:', e)
    error = 'Terjadi kesalahan saat mengambil riwayat transaksi'
  }

  if (!error) {
    try {
      const debtRows = await db
        .select({
          id: customerDebts.id,
          customerId: customerDebts.customerId,
          transactionId: customerDebts.transactionId,
          totalAmount: customerDebts.totalAmount,
          paidAmount: customerDebts.paidAmount,
          remainingAmount: customerDebts.remainingAmount,
          dueAt: customerDebts.dueAt,
          status: customerDebts.status,
          note: customerDebts.note,
          createdAt: customerDebts.createdAt,
        })
        .from(customerDebts)
        .where(eq(customerDebts.customerId, customerId))
        .orderBy(desc(customerDebts.createdAt))

      const trxMap = new Map(trxData.map((t) => [t.id, t.trxNumber]))

      const debtIds = debtRows.map((d) => d.id)
      const paymentsByDebt = new Map<number, DebtPayment[]>()
      if (debtIds.length > 0) {
        const paymentRows = await db
          .select({
            id: debtPayments.id,
            debtId: debtPayments.debtId,
            amount: debtPayments.amount,
            paymentMethodId: debtPayments.paymentMethodId,
            paymentMethodName: paymentMethods.name,
            note: debtPayments.note,
            proofPhotoUrl: debtPayments.proofPhotoUrl,
            createdAt: debtPayments.createdAt,
            voidedAt: debtPayments.voidedAt,
            voidReason: debtPayments.voidReason,
          })
          .from(debtPayments)
          .leftJoin(paymentMethods, eq(debtPayments.paymentMethodId, paymentMethods.id))
          .where(inArray(debtPayments.debtId, debtIds))
          .orderBy(asc(debtPayments.createdAt))
        for (const p of paymentRows) {
          const list = paymentsByDebt.get(p.debtId) ?? []
          list.push(p)
          paymentsByDebt.set(p.debtId, list)
        }
      }

      debtData = debtRows.map((d) => ({
        ...d,
        trxNumber: d.transactionId ? (trxMap.get(d.transactionId) ?? null) : null,
        payments: paymentsByDebt.get(d.id) ?? [],
      }))

      pmData = await db
        .select({
          id: paymentMethods.id,
          name: paymentMethods.name,
          type: paymentMethods.type,
        })
        .from(paymentMethods)
    } catch (e) {
      console.error('CustomerDetailPage debt error:', e)
      error = 'Terjadi kesalahan saat mengambil data hutang'
    }
  }

  // Kucing milik pelanggan ini (jasa grooming). Gagal memuatnya tidak boleh menjatuhkan halaman.
  let petData: PetRow[] = []
  try {
    petData = await listPets({ customerId })
  } catch (e) {
    console.error('CustomerDetailPage pets error:', e)
  }

  if (error) {
    return (
      <div className="p-6">
        <Link
          href="/master-data/customers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          ← Kembali ke Daftar Customer
        </Link>
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <CustomerDetailClient
        customer={customer}
        transactions={trxData}
        debts={debtData}
        paymentMethods={pmData}
        canViewDebts={true}
        canVoidPayment={canVoidPayment}
      />
      {petData.length > 0 && (
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Kucing <NewBadge feature="fitur/kucing-pelanggan" />
            </h2>
            <Link href="/master-data/pets" className="text-xs font-medium text-primary hover:underline">
              Kelola di Data Kucing
            </Link>
          </div>
          <ul className="divide-y divide-border text-sm">
            {petData.map((pet) => (
              <li key={pet.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="font-medium text-foreground">{pet.name}</span>
                <span className="text-muted-foreground">
                  {pet.species} · {pet.color} · {formatPetAge(pet.birthDate)}
                </span>
                {!pet.isActive && (
                  <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">Nonaktif</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
