import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/authz'
import { getFreeShippingValue } from '@/lib/ongkir-server'

export const dynamic = 'force-dynamic'

// Nilai gratis ongkir (ongkir standar) — dibaca layar bayar kasir saat ada ongkir di nota.
export async function GET() {
  try {
    const payload = await getAuth()
    if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    return NextResponse.json({ value: await getFreeShippingValue() })
  } catch (error) {
    console.error('GET /api/pos/free-shipping error:', error)
    return NextResponse.json({ error: 'Gagal membaca nilai gratis ongkir' }, { status: 500 })
  }
}
