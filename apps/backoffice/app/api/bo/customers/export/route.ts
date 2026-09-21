import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { db, customers, eq, or, ilike } from '@/lib/db'

export const dynamic = 'force-dynamic'

function escapeCsvCell(value: string): string {
  const sanitized = /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${sanitized.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    const isActiveParam = searchParams.get('isActive')

    const conditions = []

    if (q) {
      conditions.push(
        or(
          ilike(customers.name, `%${q}%`),
          ilike(customers.phone, `%${q}%`),
          ilike(customers.code, `%${q}%`)
        )
      )
    }

    if (isActiveParam === 'true') {
      conditions.push(eq(customers.isActive, true))
    } else if (isActiveParam === 'false') {
      conditions.push(eq(customers.isActive, false))
    }

    const query = db
      .select({
        code: customers.code,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        defaultTierType: customers.defaultTierType,
        isActive: customers.isActive,
        createdAt: customers.createdAt,
      })
      .from(customers)

    const result = conditions.length > 0
      ? await query.where(conditions.length === 1 ? conditions[0]! : conditions.reduce((acc, c) => acc && c))
      : await query

    const rows = [
      ['Kode', 'Nama', 'Telepon', 'Email', 'Alamat', 'Tier Harga', 'Status', 'Dibuat'],
      ...result.map((c) => [
        c.code ?? '',
        c.name,
        c.phone ?? '',
        c.email ?? '',
        c.address ?? '',
        c.defaultTierType,
        c.isActive ? 'Aktif' : 'Nonaktif',
        new Date(c.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
      ]),
    ]

    // BOM di depan supaya Excel Windows mengenali UTF-8 — nama beraksen tidak jadi mojibake.
    const csv = '﻿' + rows.map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(',')).join('\r\n')
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    const filename = `customer-${today}.csv`

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: unknown) {
    console.error('GET /api/bo/customers/export error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengekspor data customer' }, { status: 500 })
  }
}
