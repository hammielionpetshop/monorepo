import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { findBackofficeUserOfAccount, validateSession } from '@petshop/auth';
import { db, users, roles, eq } from '@/lib/db';
import { getAuthSql, getAuthMode } from '@/lib/central-auth';

type Actor = { accountId: number; localUserId: number; role: 'OWNER' | 'GM' };

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Pagar pintu internal. Semua penolakan pra-autentikasi berbentuk 404 polos agar rute tidak
 * terdeteksi dari luar. Berlapis: mode central, host internal, kunci layanan, lalu hak pelaku —
 * kunci layanan saja bukan bukti hak pelaku (spec L1 §5).
 */
export async function authorizeInternalRequest(req: Request): Promise<NextResponse | Actor> {
  const hidden = () => new NextResponse(null, { status: 404 });
  const key = process.env.HRIS_INTERNAL_KEY;
  const hosts = (process.env.INTERNAL_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (getAuthMode() !== 'central' || !key || key.length < 32 || !hosts.length) return hidden();
  if (!hosts.includes((req.headers.get('host') ?? '').toLowerCase())) return hidden();
  if (req.headers.get('x-forwarded-for') || req.headers.get('x-forwarded-host')) return hidden();
  if (!sameSecret(req.headers.get('x-internal-key'), key)) return hidden();

  const actorToken = req.headers.get('x-actor-session');
  if (!actorToken) return NextResponse.json({ error: 'Pelaku wajib disertakan.' }, { status: 403 });
  // Pelaku boleh bersesi backoffice atau HRIS (spec L2d §4): Pemilik yang bekerja di HRIS belum tentu
  // membuka backoffice di sesi itu. Hak tetap diperiksa dari pengguna backoffice yang bertaut ke akunnya.
  const authSql = getAuthSql();
  let session = await validateSession(authSql, actorToken, 'backoffice');
  let localUserId = session.ok ? session.localUserId : null;
  if (!session.ok) {
    session = await validateSession(authSql, actorToken, 'hris');
    localUserId = session.ok ? await findBackofficeUserOfAccount(authSql, session.accountId) : null;
  }
  if (!session.ok || localUserId == null) return NextResponse.json({ error: 'Sesi pelaku tidak valid.' }, { status: 403 });
  const [actor] = await db.select({ role: roles.name, isActive: users.isActive }).from(users)
    .innerJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, localUserId)).limit(1);
  if (!actor?.isActive || (actor.role !== 'OWNER' && actor.role !== 'GM')) {
    return NextResponse.json({ error: 'Hanya Owner atau GM yang dapat melakukan provisioning.' }, { status: 403 });
  }
  return { accountId: session.accountId, localUserId, role: actor.role };
}
