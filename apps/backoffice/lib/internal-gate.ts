import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { validateSession } from '@petshop/auth';
import { db, users, roles, permissions, rolePermissions, eq, and } from '@/lib/db';
import { getAuthSql, getAuthMode } from '@/lib/central-auth';

type Actor = { accountId: number; localUserId: number; role: 'OWNER' | 'GM' };

/** Pelaku kasir yang lolos pagar layanan; hak per rute diperiksa pemanggil. */
export type InternalActor = { accountId: number; localUserId: number; role: string; branchId: number };

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Pagar layanan pintu internal. Semua penolakan pra-autentikasi berbentuk 404 polos agar rute tidak
 * terdeteksi dari luar. Berlapis: mode central, host internal, kunci layanan, lalu sesi pelaku aktif.
 * Kunci layanan saja bukan bukti hak pelaku (spec L1 §5): tiap rute memeriksa hak pelakunya sendiri.
 */
export async function authorizeInternalActor(req: Request): Promise<NextResponse | InternalActor> {
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
  const [actor] = await db.select({ role: roles.name, isActive: users.isActive, branchId: users.branchId }).from(users)
    .innerJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, session.localUserId)).limit(1);
  if (!actor?.isActive) return NextResponse.json({ error: 'Akun kasir pelaku tidak aktif.' }, { status: 403 });
  return { accountId: session.accountId, localUserId: session.localUserId, role: actor.role, branchId: actor.branchId };
}

/** Pagar pintu provisioning: hanya Owner/GM. */
export async function authorizeInternalRequest(req: Request): Promise<NextResponse | Actor> {
  const actor = await authorizeInternalActor(req);
  if (actor instanceof NextResponse) return actor;
  if (actor.role !== 'OWNER' && actor.role !== 'GM') {
    return NextResponse.json({ error: 'Hanya Owner atau GM yang dapat melakukan provisioning.' }, { status: 403 });
  }
  return { accountId: actor.accountId, localUserId: actor.localUserId, role: actor.role };
}

/** Pagar pintu internal yang butuh satu hak kasir (mis. `po.unloading_sync`). */
export async function authorizeInternalPermission(req: Request, code: string, deniedMessage: string): Promise<NextResponse | InternalActor> {
  const actor = await authorizeInternalActor(req);
  if (actor instanceof NextResponse) return actor;
  const [granted] = await db.select({ code: permissions.code }).from(rolePermissions)
    .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(eq(roles.name, actor.role), eq(permissions.code, code))).limit(1);
  if (!granted) return NextResponse.json({ error: deniedMessage }, { status: 403 });
  return actor;
}
