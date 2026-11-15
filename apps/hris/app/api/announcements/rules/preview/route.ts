import { NextResponse } from 'next/server';
import { z } from 'zod';
import { emergencyTargetSchema, previewRule } from '@/modules/announcements';
import { respond, ruleActor } from '../session';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ target: emergencyTargetSchema, publishesAt: z.string().max(40).nullable(), changeKind: z.enum(['UNFAVORABLE', 'FAVORABLE']) });

// Jumlah penerima + tanggal berlaku paling cepat untuk langkah Sasaran dan Dua tanggal.
export async function POST(req: Request) {
  const guard = await ruleActor(req, true);
  if (!guard.ok) return guard.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  return respond(await previewRule(guard.actor, parsed.data));
}
