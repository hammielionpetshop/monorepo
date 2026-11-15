import { NextResponse } from 'next/server';
import { copyRejectedDraft } from '@/modules/announcements';
import { idOf, respond, ruleActor } from '../../../session';

export const dynamic = 'force-dynamic';

// "Salin jadi konsep baru" untuk konsep yang ditolak/dibatalkan (spec F3-3 §3.2).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await ruleActor(req, true);
  if (!guard.ok) return guard.response;
  const id = idOf((await params).id);
  if (!id) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  return respond(await copyRejectedDraft(guard.actor, id));
}
