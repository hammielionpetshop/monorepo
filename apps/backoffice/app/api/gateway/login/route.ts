import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isCentralMode } from '@/lib/central-cookie-name';

const bodySchema = z.object({
  identifier: z.string().trim().min(1, 'Username atau email wajib diisi').max(255),
  password: z.string().min(1, 'Password wajib diisi').max(1024),
});

/**
 * Masuk di web gateway: password akun pusat → sesi akun tanpa membuka web mana pun (spec F2-7a §2a).
 * Berbeda dengan /api/auth/login yang mewajibkan tautan Back Office, karyawan yang hanya punya HRIS
 * juga bisa masuk di sini. PIN tidak diterima.
 */
export async function POST(req: Request) {
  if (!isCentralMode()) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
  const [{ passwordLogin }, central, { describeDevice }] = await Promise.all([
    import('@petshop/auth'),
    import('@/lib/central-auth'),
    import('@/lib/device-label'),
  ]);
  const denied = await central.checkMutation(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 });
  }
  const result = await passwordLogin(central.getAuthSql(), {
    appCode: 'gateway',
    identifier: parsed.data.identifier,
    password: parsed.data.password,
    previousToken: await central.readCentralToken(),
    deviceLabel: describeDevice(req.headers.get('user-agent')) ?? undefined,
  });
  if (!result.ok) {
    const error = result.code === 'APP_ACCESS_DENIED' ? 'Akun belum punya akses web. Hubungi Owner/GM.' : result.error;
    return NextResponse.json({ error }, { status: 401 });
  }
  const response = NextResponse.json({ mustChangePassword: result.mustChangePassword });
  central.setCentralCookie(response, result.token);
  return response;
}
