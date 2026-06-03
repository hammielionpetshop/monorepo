import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Big from 'big.js'
import * as argon2 from 'argon2'
import { verifyAccessToken } from '@/lib/auth'
import {
  db,
  transactions,
  transactionItems,
  productStocks,
  products,
  productUomConversions,
  auditLogs,
  shifts,
  users,
  ownerAssignments,
  eq,
  and,
  inArray,
} from '@/lib/db'
import { StockService } from '@/lib/services/stock-service'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null

    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { id } = await params
    // Validasi ID transaksi hanya numerik
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'ID transaksi tidak valid' }, { status: 400 })
    }
    const txId = parseInt(id, 10)
    if (txId <= 0) {
      return NextResponse.json({ error: 'ID transaksi tidak valid' }, { status: 400 })
    }

    // Ambil PIN Owner dari body request
    const body = await req.json().catch(() => ({}))
    const pin = body.pin
    if (!pin || typeof pin !== 'string' || pin.length < 4 || pin.length > 6) {
      return NextResponse.json({ error: 'PIN Owner tidak valid' }, { status: 400 })
    }

    // Ambil transaksi + validasi kepemilikan branch
    const [trx] = await db
      .select({
        id: transactions.id,
        trxNumber: transactions.trxNumber,
        branchId: transactions.branchId,
        shiftId: transactions.shiftId,
        status: transactions.status,
      })
      .from(transactions)
      .where(and(eq(transactions.id, txId), eq(transactions.branchId, payload.branchId)))
      .limit(1)

    if (!trx) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }
    if (trx.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Transaksi sudah dibatalkan atau tidak dapat di-void' },
        { status: 400 }
      )
    }

    // Cek shift masih OPEN
    const [shift] = await db
      .select({ status: shifts.status })
      .from(shifts)
      .where(eq(shifts.id, trx.shiftId))
      .limit(1)

    if (!shift || shift.status !== 'OPEN') {
      return NextResponse.json({ error: 'Shift sudah ditutup, void tidak diizinkan' }, { status: 400 })
    }

    // Verifikasi PIN Owner secara server-side
    const [ownerAssignment] = await db
      .select({ userId: ownerAssignments.userId })
      .from(ownerAssignments)
      .where(and(eq(ownerAssignments.branchId, payload.branchId), eq(ownerAssignments.isActive, true)))
      .limit(1)

    if (!ownerAssignment) {
      return NextResponse.json({ error: 'Owner tidak dikonfigurasi untuk cabang ini' }, { status: 404 })
    }

    const [owner] = await db
      .select({ pinHash: users.pinHash })
      .from(users)
      .where(eq(users.id, ownerAssignment.userId))
      .limit(1)

    if (!owner?.pinHash) {
      return NextResponse.json({ error: 'PIN Owner belum dikonfigurasi. Hubungi Administrator.' }, { status: 404 })
    }

    const isValidPin = await argon2.verify(owner.pinHash, pin)
    if (!isValidPin) {
      // Jeda 1 detik untuk mitigasi brute force
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return NextResponse.json({ error: 'PIN Owner tidak valid. Void dibatalkan.' }, { status: 400 })
    }

    // Ambil items transaksi
    const items = await db
      .select({
        id: transactionItems.id,
        productId: transactionItems.productId,
        uomId: transactionItems.uomId,
        qty: transactionItems.qty,
        cogs: transactionItems.cogs,
      })
      .from(transactionItems)
      .where(eq(transactionItems.transactionId, txId))

    const productIds = [...new Set(items.map((i) => i.productId))]
    if (productIds.length === 0) {
      return NextResponse.json({ error: 'Transaksi tidak memiliki item produk untuk dibatalkan' }, { status: 400 })
    }

    // Ambil baseUomId semua produk (untuk konversi UOM)
    const productRows = await db
      .select({ id: products.id, baseUomId: products.baseUomId })
      .from(products)
      .where(inArray(products.id, productIds))
    const productBaseUomMap = new Map(productRows.map((p) => [p.id, p.baseUomId]))

    // Ambil semua konversi UOM yang diperlukan
    const conversionRows = await db
      .select({
        productId: productUomConversions.productId,
        uomId: productUomConversions.uomId,
        ratio: productUomConversions.ratio,
      })
      .from(productUomConversions)
      .where(inArray(productUomConversions.productId, productIds))
    const conversionMap = new Map(
      conversionRows.map((c) => [`${c.productId}:${c.uomId}`, c.ratio])
    )

    await db.transaction(async (tx) => {
      // Pessimistic lock pada product stocks (anti race condition)
      await tx
        .select({ id: productStocks.id })
        .from(productStocks)
        .where(and(inArray(productStocks.productId, productIds), eq(productStocks.branchId, trx.branchId)))
        .for('update')

      // 1. Update status transaksi menjadi VOIDED
      await tx
        .update(transactions)
        .set({ status: 'VOIDED', updatedAt: new Date() })
        .where(eq(transactions.id, txId))

      // 2. Kembalikan stok tiap item (FIFO reversal — masukkan batch baru)
      for (const item of items) {
        const baseUomId = productBaseUomMap.get(item.productId)
        if (!baseUomId) continue

        let ratioToBase = 1
        if (item.uomId !== baseUomId) {
          const ratio = conversionMap.get(`${item.productId}:${item.uomId}`)
          if (!ratio) {
            throw new Error(`Rasio konversi untuk produk ID ${item.productId} ke UOM basis tidak ditemukan`)
          }
          ratioToBase = Number(ratio)
        }

        const baseQtyToReturn = item.qty * ratioToBase

        // Hitung harga modal per unit base UOM dengan presisi tinggi desimal big.js
        const costPricePerUnit = baseQtyToReturn > 0
          ? new Big(item.cogs ?? 0).div(baseQtyToReturn).toString()
          : '0'

        await StockService.addStock(
          tx,
          trx.branchId,
          item.productId,
          baseUomId,
          String(baseQtyToReturn),
          costPricePerUnit,
        )
      }

      // 3. Audit log
      await tx.insert(auditLogs).values({
        branchId: trx.branchId,
        userId: payload.userId,
        action: 'VOID_TRANSACTION',
        tableName: 'transactions',
        recordId: String(txId),
        newData: JSON.stringify({ trxNumber: trx.trxNumber, voidedBy: payload.userId }),
      })
    })

    return NextResponse.json({ success: true, trxNumber: trx.trxNumber, status: 'VOIDED' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memvoid transaksi'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
