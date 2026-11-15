import { NextResponse } from 'next/server';
import { discardDraft } from '@/modules/announcements';
import { idOf, respond, ruleActor } from '../../../session';

export const dynamic = 'force-dynamic';

// Buang konsep (status DISCARDED, tidak dihapus).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await ruleActor(req, true);
  if (!guard.ok) return guard.response;
  const id = idOf((await params).id);
  if (!id) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  return respond(await discardDraft(guard.actor, id));
}
