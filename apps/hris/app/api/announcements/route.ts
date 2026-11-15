import { NextResponse } from 'next/server';
import { getRequestActor } from '@/lib/authz';
import { listEmergencies } from '@/modules/announcements';

export const dynamic = 'force-dynamic';

// Kantor › Pengumuman (spec F3-2 §3.3): daftar darurat beserta "sudah baca x dari y".
export async function GET() {
  const { session, actor } = await getRequestActor();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const result = await listEmergencies(actor);
  return result.ok ? NextResponse.json(result.value) : NextResponse.json({ error: result.error }, { status: result.status });
}
