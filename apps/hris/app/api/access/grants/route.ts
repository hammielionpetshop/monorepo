import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireMutationAction } from '@/lib/authz';
import { SCOPES, savePositionGrants } from '@/modules/access';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  positionId: z.number().int().positive(),
  changes: z.array(z.object({ action: z.string().min(1).max(100), scope: z.enum(SCOPES).nullable() })).min(1).max(200),
});

// Hak Akses Jabatan (KAR-L33). Batas keras diperiksa di layanan, bukan di layar.
export async function POST(req: Request) {
  const guard = await requireMutationAction(req, 'position.grants.update');
  if (!guard.ok) return guard.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const result = await savePositionGrants(guard.actor, parsed.data.positionId, parsed.data.changes);
  return result.ok
    ? NextResponse.json({ ok: true, changed: result.data.changed })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
