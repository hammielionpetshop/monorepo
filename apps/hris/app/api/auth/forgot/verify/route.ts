import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation } from '@/lib/auth';
import { verifyRecovery } from '@/modules/accounts';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ identifier: z.string().min(1).max(255), phone: z.string().min(1).max(30), birthDate: z.string().max(10) });

// KAR-L04 langkah 1, tanpa sesi.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Isi email, nomor HP, dan tanggal lahir.' }, { status: 400 });
  const result = await verifyRecovery(parsed.data);
  if (result.ok) return NextResponse.json({ ticket: result.ticket });
  return NextResponse.json({ error: result.error, blockedUntil: result.blockedUntil, useCode: result.useCode }, { status: result.status });
}
