import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import {
  db,
  products,
  productPrices,
  paymentMethods,
  productUomConversions,
  productStocks,
  unitsOfMeasure,
  shifts,
  shiftCashierSessions,
  shiftExpenses,
  eq,
  and,
  sql,
} from '@/lib/db'
import PosClient from '@/components/pos/pos-client'

export default async function PosHomePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null

  if (!payload) {
    redirect('/pos/login')
  }

  const branchId = payload.branchId

  const [
    allProducts,
    conversions,
    prices,
    uoms,
    payments,
    activeShift,
    expResult,
  ] = await Promise.all([
    db
      .select({
        id: products.id,
        sku: products.sku,
        barcode: products.barcode,
        name: products.name,
        categoryId: products.categoryId,
        brandId: products.brandId,
        baseUomId: products.baseUomId,
        weightGram: products.weightGram,
        stock: sql<string>`COALESCE(${productStocks.qty}, '0')`,
      })
      .from(products)
      .leftJoin(
        productStocks,
        and(
          eq(products.id, productStocks.productId),
          eq(productStocks.branchId, branchId),
          eq(productStocks.uomId, products.baseUomId)
        )
      )
      .where(eq(products.isActive, true)),

    db
      .select({
        id: productUomConversions.id,
        productId: productUomConversions.productId,
        uomId: productUomConversions.uomId,
        ratio: productUomConversions.ratio,
        weightGram: productUomConversions.weightGram,
        uomCode: unitsOfMeasure.code,
      })
      .from(productUomConversions)
      .leftJoin(unitsOfMeasure, eq(productUomConversions.uomId, unitsOfMeasure.id)),

    db.select().from(productPrices).where(eq(productPrices.branchId, branchId)),

    db.select().from(unitsOfMeasure),

    db.select().from(paymentMethods),

    db.query.shifts.findFirst({
      where: and(eq(shifts.branchId, branchId), eq(shifts.status, 'OPEN')),
    }),

    db
      .select({ total: sql<string>`COALESCE(SUM(${shiftExpenses.amount}), '0')` })
      .from(shiftExpenses)
      .innerJoin(shifts, eq(shiftExpenses.shiftId, shifts.id))
      .where(and(eq(shifts.branchId, branchId), eq(shifts.status, 'OPEN'))),
  ])

  const expenseTotal = Number(expResult[0]?.total ?? 0)

  let shiftWithSessions = null
  let isCashierInShift = false
  if (activeShift) {
    const sessions = await db
      .select({ cashierId: shiftCashierSessions.cashierId })
      .from(shiftCashierSessions)
      .where(
        and(
          eq(shiftCashierSessions.shiftId, activeShift.id),
          eq(shiftCashierSessions.status, 'ACTIVE')
        )
      )
    const joinedCashierIds = sessions.map((s) => s.cashierId)
    shiftWithSessions = {
      ...activeShift,
      assignedCashiers: (activeShift.assignedCashiers as number[]) ?? [],
      joinedCashierIds,
    }
    isCashierInShift = joinedCashierIds.includes(payload.userId)
  }

  // Convert numeric fields back to string to satisfy BootstrapProduct/BootstrapConversion/BootstrapPrice interfaces
  const productsForClient = allProducts.map((p) => ({
    ...p,
    weightGram: p.weightGram != null ? String(p.weightGram) : null,
  }))

  const conversionsForClient = conversions.map((c) => ({
    ...c,
    ratio: c.ratio != null ? String(c.ratio) : null,
    weightGram: c.weightGram != null ? String(c.weightGram) : null,
  }))

  const pricesForClient = prices.map((p) => ({
    ...p,
    price: String(p.price),
  }))

  return (
    <PosClient
      products={productsForClient}
      conversions={conversionsForClient}
      prices={pricesForClient}
      uoms={uoms}
      paymentMethods={payments}
      shift={shiftWithSessions}
      isCashierInShift={isCashierInShift}
      cashierId={payload.userId}
      cashierName={payload.userName}
      branchId={branchId}
      branchName={payload.branchName}
      userRole={payload.role}
      totalExpenses={expenseTotal}
    />
  )
}

