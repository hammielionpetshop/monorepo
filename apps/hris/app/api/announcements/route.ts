import { NextResponse } from 'next/server';
import { getRequestActor } from '@/lib/authz';
import { listEmergencies, listRuleOffice } from '@/modules/announcements';

export const dynamic = 'force-dynamic';

// Kantor › Pengumuman (spec F3-2 §3.3, F3-3 §3.5): daftar darurat, atau `?kind=RULE` perubahan aturan + konsep.
export async function GET(req: Request) {
  const { session, actor } = await getRequestActor();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const result = new URL(req.url).searchParams.get('kind') === 'RULE' ? await listRuleOffice(actor) : await listEmergencies(actor);
  return result.ok ? NextResponse.json(result.value) : NextResponse.json({ error: result.error }, { status: result.status });
}
