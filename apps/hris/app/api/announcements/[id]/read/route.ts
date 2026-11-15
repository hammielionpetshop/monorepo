import { NextResponse } from 'next/server';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { markAnnouncementRead } from '@/modules/announcements';

export const dynamic = 'force-dynamic';

// "Sudah saya baca" untuk darurat (spec F3-2 §3.3) dan perubahan aturan (spec F3-3 §3.5). Tanpa tindakan bernama: cukup termasuk sasaran.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const result = await markAnnouncementRead(await actorForSession(session.accountId, session.localUserId), id);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
}
