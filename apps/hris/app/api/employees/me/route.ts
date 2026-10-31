import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentHrisSession } from '@/lib/auth';
import { requireMutationAction } from '@/lib/authz';
import { updateOwnContact } from '@/modules/employees';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ fields: z.record(z.string(), z.unknown()) });

// Ubah kontak sendiri (KAR-L11): lingkup diri sendiri, langsung berlaku.
export async function POST(req: Request) {
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const guard = await requireMutationAction(req, 'contact.update_own', { personId: session.localUserId });
  if (!guard.ok) return guard.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const result = await updateOwnContact(guard.actor, parsed.data.fields);
  return result.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
