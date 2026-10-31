import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireMutationAction } from '@/lib/authz';
import { saveBranch, saveDepartment, savePosition, type ServiceResult } from '@/modules/access';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const name = z.string().max(200);
const coordinate = z.number().nullable();

const bodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('department'), id: id.optional(), name, active: z.boolean() }),
  z.object({
    kind: z.literal('branch'), id: id.optional(), name, address: z.string().max(500).nullable(),
    latitude: coordinate, longitude: coordinate, kasirBranchId: id.nullable(), mergedIntoBranchId: id.nullable(),
    active: z.boolean(),
  }),
  z.object({
    kind: z.literal('position'), id: id.optional(), name, departmentId: id, highRights: z.boolean(), active: z.boolean(),
  }),
]);

function respond(result: ServiceResult<{ id: number }>) {
  return result.ok
    ? NextResponse.json({ ok: true, id: result.data.id })
    : NextResponse.json({ error: result.error }, { status: result.status });
}

// Cabang, departemen, jabatan (KAR-L30). Tanda berhak tinggi diperiksa lagi di layanan.
export async function POST(req: Request) {
  const guard = await requireMutationAction(req, 'org.manage');
  if (!guard.ok) return guard.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const body = parsed.data;
  switch (body.kind) {
    case 'department': return respond(await saveDepartment(guard.actor, body));
    case 'branch': return respond(await saveBranch(guard.actor, body));
    case 'position': return respond(await savePosition(guard.actor, body));
  }
}
