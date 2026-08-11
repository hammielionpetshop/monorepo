import { SignJWT, jwtVerify } from 'jose';
import { JWTPayload } from '@petshop/shared';

function requiredSecret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET') {
  const secret = process.env[name];

  if (!secret) {
    throw new Error(`${name} belum dikonfigurasi`);
  }

  return new TextEncoder().encode(secret);
}

export async function signAccessToken(payload: JWTPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d') // Access token for 1 day as per requirement (flexible)
    .sign(requiredSecret('JWT_SECRET'));
}

export async function signRefreshToken(payload: { userId: number }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(requiredSecret('JWT_REFRESH_SECRET'));
}

/**
 * Verifikasi tanda tangan token SAJA, tanpa menyentuh database.
 *
 * Khusus untuk `middleware.ts`, yang berjalan di Edge runtime dan karena itu tidak bisa
 * memanggil Postgres. Konsekuensinya middleware bisa meloloskan token yang sesinya sudah
 * dicabut — itu tidak berbahaya, karena setiap halaman dan route handler di belakangnya
 * memakai `verifyAccessToken` yang memeriksa sesi. Middleware di sini hanya mengatur
 * pengalihan (role guard, gerbang onboarding), bukan gerbang keamanan terakhir.
 *
 * JANGAN pakai ini di route handler atau server component. Pakai `verifyAccessToken`.
 */
export async function verifyAccessTokenSignatureOnly(token: string) {
  try {
    const { payload } = await jwtVerify(token, requiredSecret('JWT_SECRET'));
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Verifikasi token + pastikan sesinya belum dicabut.
 *
 * Cek sesi sengaja ditaruh DI SINI, bukan di masing-masing pemanggil: 97 berkas memanggil
 * fungsi ini langsung, di samping `getAuth()` dan `verifyAccessTokenCached`. Menaruhnya di
 * lapisan atas berarti sebagian jalur memeriksa sesi dan sebagian tidak — dan yang tidak
 * memeriksa akan tetap melayani token yang sudah dicabut, tanpa error apa pun yang kelihatan.
 *
 * Token tanpa `sessionId` diterima apa adanya. Itu token terbitan sebelum fitur ini ada;
 * menolaknya akan melempar keluar semua orang yang sedang bekerja pada saat deploy, dan
 * tokennya toh mati sendiri dalam 1 hari.
 */
export async function verifyAccessToken(token: string) {
  const payload = await verifyAccessTokenSignatureOnly(token);
  if (!payload) return null;

  if (payload.sessionId === undefined) return payload;

  // Import dinamis: `lib/auth.ts` ikut terbawa ke bundel Edge lewat middleware, dan impor
  // statis ke lapisan database akan menyeret driver Postgres ke sana.
  const { isSessionActive } = await import('@/lib/services/user-session');
  return (await isSessionActive(payload.sessionId)) ? payload : null;
}
