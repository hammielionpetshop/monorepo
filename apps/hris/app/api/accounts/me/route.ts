import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { revokeOtherDevices } from '@/modules/accounts';
import { can, loadActor } from '@/modules/access';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ kind: z.literal('revoke_other_devices') });

// KAR-L14: pemilik akun mengeluarkan perangkat lainnya; perangkat ini tetap masuk.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  if (!bodySchema.safeParse(await req.json().catch(() => null)).success) {
    return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  }
  const actor = await loadActor(session.accountId, session.localUserId);
  if (!can(actor, 'own_account.manage', { personId: actor.personId })) {
    return NextResponse.json({ error: 'Anda tidak berhak melakukan tindakan ini.' }, { status: 403 });
  }
  const result = await revokeOtherDevices(actor, session.sessionId);
  return result.ok
    ? NextResponse.json({ ok: true, ...result.data })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
