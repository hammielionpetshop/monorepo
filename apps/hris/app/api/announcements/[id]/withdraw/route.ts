import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withdrawRule } from '@/modules/announcements';
import { idOf, respond, ruleActor } from '../../rules/session';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ reason: z.string().max(1000) });

// Tarik perubahan aturan (hanya sebelum berlaku, alasan wajib).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await ruleActor(req, true);
  if (!guard.ok) return guard.response;
  const id = idOf((await params).id);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!id || !parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  return respond(await withdrawRule(guard.actor, id, parsed.data.reason));
}
