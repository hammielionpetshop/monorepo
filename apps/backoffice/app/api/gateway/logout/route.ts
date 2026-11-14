import { NextResponse } from 'next/server';
import { isCentralMode } from '@/lib/central-cookie-name';

/** Keluar dari gateway = mengakhiri sesi pusat, sehingga semua web meminta masuk lagi (spec F2-7a §4). */
export async function POST(req: Request) {
  if (!isCentralMode()) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
  const [{ logoutSession }, central] = await Promise.all([import('@petshop/auth'), import('@/lib/central-auth')]);
  const denied = await central.checkMutation(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const token = await central.readCentralToken();
  if (token) await logoutSession(central.getAuthSql(), token);
  const response = NextResponse.json({ ok: true });
  central.clearCentralCookie(response);
  return response;
}
