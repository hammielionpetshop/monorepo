import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireMutationAction } from '@/lib/authz';
import { countRecipients, emergencyTargetSchema } from '@/modules/announcements';

export const dynamic = 'force-dynamic';

// Jumlah penerima untuk sasaran yang sedang dipilih (langkah 2–3 layar kirim).
export async function POST(req: Request) {
  const guard = await requireMutationAction(req, 'announcement.emergency.send');
  if (!guard.ok) return guard.response;
  const parsed = z.object({ target: emergencyTargetSchema }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  return NextResponse.json({ recipients: await countRecipients(parsed.data.target) });
}
