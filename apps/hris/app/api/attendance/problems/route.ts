import { NextResponse } from 'next/server';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { loadActor } from '@/modules/access';
import { submitProblem } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// Lapor Masalah dari menu (KEH-L23). Hanya Pemilik dan GM yang membaca.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const photo = form.get('photo');
  const actor = await loadActor(session.accountId, session.localUserId);
  const result = await submitProblem(actor, {
    body: String(form.get('body') ?? ''), photo: photo instanceof File && photo.size > 0 ? photo : null, concernsGm: form.get('concernsGm') === 'true',
  });
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}
