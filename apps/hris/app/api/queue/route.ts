import { NextResponse } from 'next/server';
import { getRequestActor } from '@/lib/authz';
import { webOriginsFromEnv } from '@/lib/web-split';
import { currentWeb } from '@/lib/web-split-server';
import { listQueue } from '@/modules/attention';

export const dynamic = 'force-dynamic';

// Antrean berantai (spec F3-1 §3.4): jendela untuk akun yang masuk, sudah berurutan.
export async function GET() {
  const { session, actor } = await getRequestActor();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const items = await listQueue(session.accountId, actor, await currentWeb(), webOriginsFromEnv());
  return NextResponse.json({ items });
}
