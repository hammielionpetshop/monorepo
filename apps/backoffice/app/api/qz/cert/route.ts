import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessTokenCached } from '@/lib/auth-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sertifikat publik penanda QZ Tray. Dibaca `qz.security.setCertificatePromise` di klien
// untuk mengidentifikasi situs ke QZ Tray. Bukan rahasia, tapi tetap di balik sesi login.
//
// Bila QZ_CERTIFICATE belum diisi: balas 501, dan qz-tray.js jatuh ke mode anonim.
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  const cert = readPem(process.env.QZ_CERTIFICATE)
  if (!cert) {
    return new NextResponse('QZ certificate belum dikonfigurasi', { status: 501 })
  }

  return new NextResponse(cert, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

/**
 * Normalkan PEM dari env: sebagian loader `env_file` menyimpan tanda kutip pembungkus
 * secara literal, dan newline kerap tersimpan sebagai `\n` literal.
 */
function readPem(value: string | undefined): string | null {
  if (!value) return null
  let pem = value.trim()
  if (
    (pem.startsWith('"') && pem.endsWith('"')) ||
    (pem.startsWith("'") && pem.endsWith("'"))
  ) {
    pem = pem.slice(1, -1)
  }
  if (pem.includes('\\n')) pem = pem.replace(/\\n/g, '\n')
  return pem.includes('BEGIN') ? pem : null
}
