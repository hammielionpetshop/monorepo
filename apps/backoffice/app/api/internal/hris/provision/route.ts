import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeInternalRequest } from '@/lib/internal-gate';
import { provisionUserAccount } from '@/lib/services/central-provisioning';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ userId: z.number().int().positive() });

// Pintu internal untuk HRIS: backoffice tetap satu-satunya penulis tabel petshop.
export async function POST(req: NextRequest) {
  const actor = await authorizeInternalRequest(req);
  if (actor instanceof NextResponse) return actor;

  const idempotencyKey = req.headers.get('idempotency-key');
  if (!idempotencyKey) return NextResponse.json({ error: 'Header Idempotency-Key wajib.' }, { status: 400 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });

  const result = await provisionUserAccount({
    userId: parsed.data.userId, idempotencyKey, actorAccountId: actor.accountId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ accountId: result.accountId, created: result.created }, { status: result.created ? 201 : 200 });
}
