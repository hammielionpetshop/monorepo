import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { requirePermission } from '@/lib/authz'
import { db } from '@/lib/db'
import {
  getPricesForExport,
  rowsToCsv,
  rowsToXlsxBuffer,
} from '@/lib/services/price-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface BranchRow { id: number; code: string; name: string }

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePermission('master.price.manage')
    if (gate instanceof NextResponse) return gate

    const { searchParams } = req.nextUrl
    const branchIdParam = searchParams.get('branchId')
    if (!branchIdParam || !/^\d+$/.test(branchIdParam)) {
      return NextResponse.json({ error: 'branchId wajib diisi' }, { status: 400 })
    }
    const branchId = Number(branchIdParam)

    const format = (searchParams.get('format') ?? 'xlsx').toLowerCase()
    if (format !== 'csv' && format !== 'xlsx') {
      return NextResponse.json({ error: 'format harus csv atau xlsx' }, { status: 400 })
    }

    const categoryIdParam = searchParams.get('categoryId')
    const categoryId = categoryIdParam && /^\d+$/.test(categoryIdParam) ? Number(categoryIdParam) : null
    const search = searchParams.get('search')?.trim() || null

    // Ambil code cabang untuk nama file
    const branchRows = await db.execute(sql`
      SELECT id, code, name FROM petshop.branches WHERE id = ${branchId} LIMIT 1
    `) as unknown as BranchRow[]
    const branch = branchRows[0]
    if (!branch) {
      return NextResponse.json({ error: 'Cabang tidak ditemukan' }, { status: 404 })
    }

    const rows = await getPricesForExport({ branchId, categoryId, search })

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const safeCode = branch.code.replace(/[^a-zA-Z0-9_-]/g, '_')
    const fileName = `harga_${safeCode}_${today}.${format}`

    if (format === 'csv') {
      // BOM supaya Excel Windows kenali UTF-8
      const body = '\uFEFF' + rowsToCsv(rows)
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      })
    }

    const buf = rowsToXlsxBuffer(rows)
    const body = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('GET /api/bo/master-data/prices/export error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat export harga' }, { status: 500 })
  }
}
