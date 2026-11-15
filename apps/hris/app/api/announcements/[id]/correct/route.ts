import { NextResponse } from 'next/server';
import { startCorrection } from '@/modules/announcements';
import { idOf, respond, ruleActor } from '../../rules/session';

export const dynamic = 'force-dynamic';

// Ralat: buat (atau buka) konsep yang terisi dari pengumuman ini.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await ruleActor(req, true);
  if (!guard.ok) return guard.response;
  const id = idOf((await params).id);
  if (!id) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  return respond(await startCorrection(guard.actor, id));
}
