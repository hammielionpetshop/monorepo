import { NextResponse } from 'next/server';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { loadActor } from '@/modules/access';
import { submitAttendance } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// Kirim absen beserta foto (KEH-L07 langkah 4). Jam = jam server saat permintaan ini diterima.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const attemptId = Number(form?.get('attemptId'));
  const kind = form?.get('kind');
  const photo = form?.get('photo');
  if (!Number.isInteger(attemptId) || attemptId <= 0 || (kind !== 'IN' && kind !== 'RETURN' && kind !== 'OUT')) {
    return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  }
  const actor = await loadActor(session.accountId, session.localUserId);
  const result = await submitAttendance(actor, { attemptId, kind, photo: photo instanceof File ? photo : null });
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}
