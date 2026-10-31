import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeInternalRequest } from '@/lib/internal-gate';
import {
  HRIS_BACKOFFICE_ROLES, getBackofficeAccess, setBackofficeAccess,
} from '@/lib/services/hris-backoffice-access';
import { db, branches, roles, eq, inArray } from '@/lib/db';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const bodySchema = z.object({
  accountId: id,
  employeeName: z.string().trim().min(1).max(100),
  employeeCode: z.string().trim().min(1).max(50),
  roleName: z.enum(HRIS_BACKOFFICE_ROLES),
  branchId: id,
  assignedBranchIds: z.array(id).max(50),
  active: z.boolean(),
});

/**
 * Akses kasir dari HRIS (spec L2d §4). Backoffice tetap satu-satunya penulis tabel petshop.
 * GET: keadaan akses kasir per akun + pilihan role/cabang. POST: setel akses (aman diulang).
 */
export async function GET(req: NextRequest) {
  const actor = await authorizeInternalRequest(req);
  if (actor instanceof NextResponse) return actor;
  const raw = req.nextUrl.searchParams.get('accountIds') ?? '';
  const accountIds = raw.split(',').filter((v) => /^\d+$/.test(v)).map(Number).slice(0, 500);
  const [access, roleRows, branchRows] = await Promise.all([
    getBackofficeAccess(accountIds),
    db.select({ name: roles.name }).from(roles).where(inArray(roles.name, [...HRIS_BACKOFFICE_ROLES])),
    db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(branches.name),
  ]);
  const roleNames = HRIS_BACKOFFICE_ROLES.filter((name) => roleRows.some((row) => row.name === name));
  return NextResponse.json({ access, roles: roleNames, branches: branchRows });
}

export async function POST(req: NextRequest) {
  const actor = await authorizeInternalRequest(req);
  if (actor instanceof NextResponse) return actor;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });

  const result = await setBackofficeAccess({
    ...parsed.data, actorUserId: actor.localUserId, actorAccountId: actor.accountId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ userId: result.userId, created: result.created }, { status: result.created ? 201 : 200 });
}
