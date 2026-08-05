import { NextResponse } from 'next/server'

// Probe koneksi untuk UI — sengaja TIDAK menyentuh database.
// Endpoint ini dipanggil berkala oleh setiap tab yang terbuka, jadi harus semurah
// mungkin; tugasnya hanya membuktikan "browser masih bisa menjangkau server ini".
// Cek kesehatan database tetap di /api/health.
//
// Header x-hammielion-ping dipakai klien untuk mendeteksi captive portal
// (WiFi hotel/kafe yang membalas 200 berisi halaman login, bukan respons kita).
export const dynamic = 'force-dynamic'
export const revalidate = 0

const PING_HEADERS = {
  'x-hammielion-ping': '1',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

export async function GET() {
  return new NextResponse(null, { status: 204, headers: PING_HEADERS })
}

export async function HEAD() {
  return new NextResponse(null, { status: 204, headers: PING_HEADERS })
}
