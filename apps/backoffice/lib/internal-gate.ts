import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { validateSession } from '@petshop/auth';
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
  const session = await validateSession(getAuthSql(), actorToken, 'backoffice');
  if (!session.ok) return NextResponse.json({ error: 'Sesi pelaku tidak valid.' }, { status: 403 });
  const [actor] = await db.select({ role: roles.name, isActive: users.isActive }).from(users)
    .innerJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, session.localUserId)).limit(1);
  if (!actor?.isActive || (actor.role !== 'OWNER' && actor.role !== 'GM')) {
    return NextResponse.json({ error: 'Hanya Owner atau GM yang dapat melakukan provisioning.' }, { status: 403 });
  }
  return { accountId: session.accountId, localUserId: session.localUserId, role: actor.role };
}
