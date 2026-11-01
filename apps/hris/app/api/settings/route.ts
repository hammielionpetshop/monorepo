import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { announceToOwners } from '@/lib/owner-notify';
import { loadActor } from '@/modules/access';
import { cancelSetting, setSetting } from '@/modules/settings';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('set'),
    key: z.string().min(1).max(100),
    targetKind: z.enum(['ALL', 'POSITION', 'BRANCH']),
    targetId: z.number().int().positive().nullable(),
    value: z.union([z.number(), z.string().max(100)]),
    effectiveFrom: z.string().max(10),
    reason: z.string().max(500),
    expectedLatestId: z.number().int().positive().nullable(),
  }),
  z.object({ kind: z.literal('cancel'), id: z.number().int().positive(), reason: z.string().max(500) }),
]);

// BER-L41 Ubah satu pengaturan. Hak diperiksa per pengaturan di layanan (`editAction` di daftar pengaturan).
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await loadActor(session.accountId, session.localUserId);
  const body = parsed.data;
  const result = body.kind === 'set' ? await setSetting(actor, body, announceToOwners) : await cancelSetting(actor, body.id, body.reason, announceToOwners);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
}
