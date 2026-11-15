import { NextResponse } from 'next/server';
import { draftInputSchema, getDraft, updateDraft } from '@/modules/announcements';
import { idOf, respond, ruleActor } from '../../session';

export const dynamic = 'force-dynamic';

// Buka (GET) dan ubah (POST, lewat postJson ber-CSRF) konsep perubahan aturan; hanya yang masih Konsep.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await ruleActor(req, false);
  if (!guard.ok) return guard.response;
  const id = idOf((await params).id);
  if (!id) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  return respond(await getDraft(guard.actor, id));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await ruleActor(req, true);
  if (!guard.ok) return guard.response;
  const id = idOf((await params).id);
  const parsed = draftInputSchema.safeParse(await req.json().catch(() => null));
  if (!id || !parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  return respond(await updateDraft(guard.actor, id, parsed.data));
}
