import { NextResponse } from 'next/server';
import { createDraft, draftInputSchema } from '@/modules/announcements';
import { respond, ruleActor } from '../session';

export const dynamic = 'force-dynamic';

// Simpan konsep perubahan aturan baru (spec F3-3 §3.5, BER-L23).
export async function POST(req: Request) {
  const guard = await ruleActor(req, true);
  if (!guard.ok) return guard.response;
  const parsed = draftInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  return respond(await createDraft(guard.actor, parsed.data));
}
