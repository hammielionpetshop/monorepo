import { NextResponse } from 'next/server';
import { getRequestActor } from '@/lib/authz';
import { webOriginsFromEnv } from '@/lib/web-split';
import { currentWeb } from '@/lib/web-split-server';
import { listQueue } from '@/modules/attention';
import { emergencyLimits, pendingEmergencies } from '@/modules/announcements';

export const dynamic = 'force-dynamic';

// Antrean berantai (spec F3-1 §3.4): jendela untuk akun yang masuk, sudah berurutan. Pengumuman darurat
// (spec F3-2 §3.3) dikembalikan terpisah dan selalu didahulukan; `?only=emergency` = pemeriksaan tiap menit.
export async function GET(req: Request) {
  const { session, actor } = await getRequestActor();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const onlyEmergency = new URL(req.url).searchParams.get('only') === 'emergency';
  const emergencies = await pendingEmergencies(actor);
  const emergencyHoldSeconds = emergencies.length ? (await emergencyLimits()).holdSeconds : null;
  if (onlyEmergency) return NextResponse.json({ emergencies, emergencyHoldSeconds });
  const items = await listQueue(session.accountId, actor, await currentWeb(), webOriginsFromEnv());
  return NextResponse.json({ items, emergencies, emergencyHoldSeconds });
}
