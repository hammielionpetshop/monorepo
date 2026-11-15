import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireMutationAction } from '@/lib/authz';
import { endEmergency } from '@/modules/announcements';

export const dynamic = 'force-dynamic';

// Akhiri sekarang (spec F3-2 §3.3): yang belum membaca tidak lagi mendapat jendelanya.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMutationAction(req, 'announcement.emergency.send');
  if (!guard.ok) return guard.response;
  const id = Number((await params).id);
  const parsed = z.object({ reason: z.string().max(1000) }).safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || id <= 0 || !parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const result = await endEmergency(guard.actor, id, parsed.data.reason);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
}
