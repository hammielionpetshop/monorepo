import { NextResponse } from 'next/server';
import { ruleDetail } from '@/modules/announcements';
import { idOf, respond, ruleActor } from '../../announcements/rules/session';

export const dynamic = 'force-dynamic';

// Rincian perubahan aturan (BER-L09); hanya sasaran atau yang pernah membaca.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await ruleActor(req, false);
  if (!guard.ok) return guard.response;
  const id = idOf((await params).id);
  if (!id) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  return respond(await ruleDetail(guard.actor, id));
}
