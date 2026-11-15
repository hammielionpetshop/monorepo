import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireMutationAction } from '@/lib/authz';
import { emergencyTargetSchema, sendEmergency } from '@/modules/announcements';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  title: z.string().max(500),
  message: z.string().max(5000),
  target: emergencyTargetSchema,
  showsUntilDate: z.string().max(10),
});

// Kirim pengumuman darurat (spec F3-2 §3.3, BER-L24).
export async function POST(req: Request) {
  const guard = await requireMutationAction(req, 'announcement.emergency.send');
  if (!guard.ok) return guard.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const result = await sendEmergency(guard.actor, parsed.data);
  return result.ok ? NextResponse.json(result.value) : NextResponse.json({ error: result.error }, { status: result.status });
}
