import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import {
  and,
  auditLogs,
  db,
  eq,
  inArray,
  isNull,
  productStocks,
  productUomConversions,
  products,
  soResolutionEmployeeCharges,
  soVarianceResolutions,
  stockOpnameItems,
  stockOpnames,
  users,
} from '@/lib/db'
import { applyManualStockAdjustment } from '@/lib/stock-adjustment'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  itemId: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const employeeChargeSchema = z.object({
  employeeName: z.string().trim().min(1, 'Nama karyawan wajib diisi').max(150),
  // Opsional — cuma terisi kalau orangnya kebetulan punya akun sistem. Daftar `users`
  // adalah daftar akun login, bukan daftar lengkap seluruh karyawan toko.
  employeeId: z.number().int().positive().optional().nullable(),
  amount: z.number().int().positive('Nominal harus lebih dari 0'),
  note: z.string().trim().max(255).optional(),
})

const bodySchema = z.object({
  disposition: z.enum(['FOUND', 'WRITTEN_OFF', 'EMPLOYEE_CHARGE', 'OVERAGE_EXPLAINED']),
  note: z.string().trim().min(1, 'Catatan wajib diisi').max(1000),
  employeeCharges: z.array(employeeChargeSchema).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const gate = await requirePermission('stock_opname.resolve')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const currentUserId = Number(payload.userId)
    if (Number.isNaN(currentUserId)) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (req.headers.get('content-type')?.includes('application/json') !== true) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const { itemId } = await params
    const paramParsed = paramsSchema.safeParse({ itemId })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const itemIdNum = Number(paramParsed.data.itemId)

    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    const { disposition, note, employeeCharges } = parsed.data

    if (disposition === 'EMPLOYEE_CHARGE' && (!employeeCharges || employeeCharges.length === 0)) {
      return NextResponse.json(
        { error: 'Minimal satu karyawan wajib diisi untuk disposisi tagih karyawan' },
        { status: 400 }
      )
    }

    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          itemId: stockOpnameItems.id,
          productId: stockOpnameItems.productId,
          uomId: stockOpnameItems.uomId,
          baseUomId: products.baseUomId,
          itemStatus: stockOpnameItems.itemStatus,
          varianceQty: stockOpnameItems.varianceQty,
          varianceCostValue: stockOpnameItems.varianceCostValue,
          soId: stockOpnames.id,
          soNumber: stockOpnames.soNumber,
          soType: stockOpnames.type,
          soStatus: stockOpnames.status,
          branchId: stockOpnames.branchId,
        })
        .from(stockOpnameItems)
        .innerJoin(stockOpnames, eq(stockOpnameItems.soId, stockOpnames.id))
        .innerJoin(products, eq(stockOpnameItems.productId, products.id))
        .where(eq(stockOpnameItems.id, itemIdNum))
        .for('update')
        .limit(1)

      const item = rows[0]
      if (!item) throw new Error('ITEM_NOT_FOUND')

      if (
        item.soType !== 'FULL' ||
        item.soStatus !== 'APPROVED' ||
        item.itemStatus !== 'APPROVED' ||
        item.varianceQty === 0
      ) {
        throw new Error('ITEM_NOT_ELIGIBLE')
      }

      if (payload.branchScope !== 'ALL' && payload.branchId !== item.branchId) {
        throw new Error('BRANCH_FORBIDDEN')
      }

      // Kunci baris resolusi aktif kalau ada, supaya dua request resolve bersamaan
      // untuk item yang sama tidak lolos berdua-duanya.
      const existing = await tx
        .select({ id: soVarianceResolutions.id })
        .from(soVarianceResolutions)
        .where(and(eq(soVarianceResolutions.soItemId, itemIdNum), isNull(soVarianceResolutions.voidedAt)))
        .for('update')
        .limit(1)
      if (existing.length > 0) throw new Error('ALREADY_RESOLVED')

      const isShortage = item.varianceQty < 0
      if ((disposition === 'FOUND' || disposition === 'WRITTEN_OFF' || disposition === 'EMPLOYEE_CHARGE') && !isShortage) {
        throw new Error('DISPOSITION_SIGN_MISMATCH_SHORTAGE')
      }
      if (disposition === 'OVERAGE_EXPLAINED' && isShortage) {
        throw new Error('DISPOSITION_SIGN_MISMATCH_OVERAGE')
      }

      const varianceCostValue = item.varianceCostValue ?? 0
      let employeeChargedTotal = 0
      let preparedCharges: { employeeName: string; employeeId: number | null; amount: number; note: string | null }[] = []

      if (disposition === 'EMPLOYEE_CHARGE') {
        const sum = employeeCharges!.reduce((s, c) => s + c.amount, 0)
        if (sum > varianceCostValue) throw new Error('EMPLOYEE_CHARGE_SUM_TOO_HIGH')

        const employeeIds = employeeCharges!
          .map((c) => c.employeeId)
          .filter((id): id is number => id != null)
        if (employeeIds.length > 0) {
          const activeUsers = await tx
            .select({ id: users.id })
            .from(users)
            .where(and(inArray(users.id, employeeIds), eq(users.isActive, true)))
          const activeSet = new Set(activeUsers.map((u) => u.id))
          if (employeeIds.some((id) => !activeSet.has(id))) {
            throw new Error('EMPLOYEE_ID_INVALID')
          }
        }

        employeeChargedTotal = sum
        preparedCharges = employeeCharges!.map((c) => ({
          employeeName: c.employeeName,
          employeeId: c.employeeId ?? null,
          amount: c.amount,
          note: c.note?.trim() ? c.note.trim() : null,
        }))
      }

      let stockAdjustmentId: number | null = null
      if (disposition === 'FOUND') {
        const baseUomId = item.baseUomId ?? item.uomId

        let ratio = 1
        if (item.uomId !== baseUomId) {
          const [conv] = await tx
            .select({ ratio: productUomConversions.ratio })
            .from(productUomConversions)
            .where(
              and(
                eq(productUomConversions.productId, item.productId),
                eq(productUomConversions.uomId, item.uomId)
              )
            )
            .limit(1)
          ratio = conv?.ratio ?? 1
        }
        const varianceBaseAbs = Math.abs(Math.round(item.varianceQty * ratio))

        const [aggRow] = await tx
          .select({ qty: productStocks.qty })
          .from(productStocks)
          .where(
            and(
              eq(productStocks.productId, item.productId),
              eq(productStocks.branchId, item.branchId),
              eq(productStocks.uomId, baseUomId)
            )
          )
          .for('update')
          .limit(1)
        const previousQty = aggRow ? Number(aggRow.qty) : 0

        const absVarianceQty = Math.abs(item.varianceQty)
        // HPP diambil dari nilai selisih ASAL (saat item ini dikurangi), bukan HPP
        // terkini — batch koreksi harus masuk dengan valuasi yang sama seperti saat ia
        // "dihilangkan", supaya Nilai Stok tidak diam-diam berubah karena harga terbaru.
        const costPricePerUnit = absVarianceQty > 0 ? Math.round(varianceCostValue / absVarianceQty) : 0

        const adjustment = await applyManualStockAdjustment(tx, {
          productId: item.productId,
          branchId: item.branchId,
          uomId: baseUomId,
          previousQty: String(previousQty),
          newQty: String(previousQty + varianceBaseAbs),
          reason: `Ditemukan kembali — ${item.soNumber} item #${item.itemId}`,
          adjustedById: currentUserId,
          costPricePerUnit,
        })
        stockAdjustmentId = adjustment.stockAdjustmentId
      }

      const [resolution] = await tx
        .insert(soVarianceResolutions)
        .values({
          soItemId: item.itemId,
          soId: item.soId,
          branchId: item.branchId,
          productId: item.productId,
          disposition,
          varianceQty: item.varianceQty,
          varianceCostValue,
          employeeChargedTotal,
          note,
          stockAdjustmentId,
          resolvedById: currentUserId,
        })
        .returning()

      if (disposition === 'EMPLOYEE_CHARGE' && preparedCharges.length > 0) {
        await tx.insert(soResolutionEmployeeCharges).values(
          preparedCharges.map((c) => ({
            resolutionId: resolution.id,
            employeeName: c.employeeName,
            employeeId: c.employeeId,
            amount: c.amount,
            note: c.note,
          }))
        )
      }

      await tx.insert(auditLogs).values({
        branchId: item.branchId,
        userId: currentUserId,
        action: 'SO_VARIANCE_RESOLUTION_CREATE',
        tableName: 'so_variance_resolutions',
        recordId: String(resolution.id),
        oldData: JSON.stringify({ soItemId: item.itemId, itemStatus: item.itemStatus }),
        newData: JSON.stringify({ disposition, varianceCostValue, employeeChargedTotal, stockAdjustmentId }),
      })

      return { resolution, employeeCharges: preparedCharges }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'ITEM_NOT_FOUND':
          return NextResponse.json({ error: 'Item stock opname tidak ditemukan' }, { status: 404 })
        case 'ITEM_NOT_ELIGIBLE':
          return NextResponse.json(
            {
              error:
                'Item ini belum memenuhi syarat untuk diresolusi (harus item SO Besar yang sudah disetujui dan punya selisih)',
            },
            { status: 400 }
          )
        case 'BRANCH_FORBIDDEN':
          return NextResponse.json(
            { error: 'Akses ditolak. Anda hanya dapat meresolusi stock opname cabang Anda sendiri.' },
            { status: 403 }
          )
        case 'ALREADY_RESOLVED':
          return NextResponse.json({ error: 'Item ini sudah pernah diresolusi' }, { status: 409 })
        case 'DISPOSITION_SIGN_MISMATCH_SHORTAGE':
          return NextResponse.json(
            { error: 'Disposisi ini hanya berlaku untuk selisih minus (kekurangan stok)' },
            { status: 400 }
          )
        case 'DISPOSITION_SIGN_MISMATCH_OVERAGE':
          return NextResponse.json(
            { error: 'Disposisi "lebih dengan alasan" hanya berlaku untuk selisih plus (kelebihan stok)' },
            { status: 400 }
          )
        case 'EMPLOYEE_CHARGE_SUM_TOO_HIGH':
          return NextResponse.json(
            { error: 'Total tagihan ke karyawan tidak boleh melebihi nilai selisih' },
            { status: 400 }
          )
        case 'EMPLOYEE_ID_INVALID':
          return NextResponse.json(
            { error: 'Salah satu karyawan yang dipilih tidak aktif atau tidak ditemukan' },
            { status: 400 }
          )
      }
    }
    console.error('POST /api/bo/stock-opnames/items/[itemId]/resolution error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan resolusi' }, { status: 500 })
  }
}
