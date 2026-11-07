import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { recordShortSettlement, saveMoneyCheck, voidMoneyCheck, voidShortSettlement } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const money = z.number().int().min(0).max(1_000_000_000);
const source = z.enum(['TRUCK', 'SELF']);
const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('check'), source, paymentId: id,
    lines: z.array(z.object({ transactionId: id, reported: money, actual: money, note: z.string().max(300).nullable().optional() })).min(1).max(30),
  }),
  z.object({ action: z.literal('void'), source, paymentId: id, reason: z.string().max(500) }),
  // B3: tindak lanjut kurang serah selain Potongan Lain.
  z.object({
    action: z.literal('settle'), source, paymentId: id, kind: z.enum(['CASH_REPLACED', 'WAIVED']), amount: money.nullable(),
    note: z.string().max(500), proofFileId: z.string().max(64).nullable(),
  }),
  z.object({ action: z.literal('settle_void'), id, reason: z.string().max(500) }),
]);

// Terima Uang (spec LT1 §16.1): simpan pemeriksaan per nota satu cara bayar, atau batalkan pemeriksaannya.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const body = parsed.data;
  const result = body.action === 'check'
    ? await saveMoneyCheck(actor, { source: body.source, paymentId: body.paymentId, lines: body.lines })
    : body.action === 'void'
      ? await voidMoneyCheck(actor, { source: body.source, paymentId: body.paymentId, reason: body.reason })
      : body.action === 'settle'
        ? await recordShortSettlement(actor, body)
        : await voidShortSettlement(actor, { id: body.id, reason: body.reason });
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
}
