import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireMutationAction } from '@/lib/authz';
import { computeComparison, saveComparisonCause } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const text = (max: number) => z.string().max(max).nullable();
const bodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('compute'), runId: id }),
  z.object({ kind: z.literal('cause'), slipId: id, cause: z.enum(['INTENDED', 'FIX']).nullable(), ruleRef: text(40), note: text(500) }),
]);

// Uji banding (spec L9 §4): simpan hitungan HRIS (maks dua kali) dan sebab selisih. Hanya Pemilik/GM.
export async function POST(req: Request) {
  const guard = await requireMutationAction(req, 'migration.comparison');
  if (!guard.ok) return guard.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Isian tidak sah.' }, { status: 400 });
  const body = parsed.data;
  const result = body.kind === 'compute'
    ? await computeComparison(guard.actor, body.runId)
    : await saveComparisonCause(guard.actor, body.slipId, { cause: body.cause, ruleRef: body.ruleRef, note: body.note });
  return result.ok ? NextResponse.json(result.data) : NextResponse.json({ error: result.error }, { status: result.status });
}
