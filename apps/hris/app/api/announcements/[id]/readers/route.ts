import { NextResponse } from 'next/server';
import { getRequestActor } from '@/lib/authz';
import { emergencyReaders } from '@/modules/announcements';

export const dynamic = 'force-dynamic';

// Siapa sudah dan belum baca (spec F3-2 §3.3, BER-L25).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, actor } = await getRequestActor();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const result = await emergencyReaders(actor, id);
  return result.ok ? NextResponse.json(result.value) : NextResponse.json({ error: result.error }, { status: result.status });
}
