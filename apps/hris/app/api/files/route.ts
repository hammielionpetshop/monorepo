import { NextResponse } from 'next/server';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { loadActor } from '@/modules/access';
import { saveUpload } from '@/modules/files';

export const dynamic = 'force-dynamic';

// Unggah foto ke volume tertutup HRIS (spec L2f-1 §3.4). Pemakaiannya (lampiran) diperiksa saat dilampirkan.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const actor = await loadActor(session.accountId, session.localUserId);
  const result = await saveUpload(actor, file instanceof File ? file : null);
  return result.ok ? NextResponse.json(result.data) : NextResponse.json({ error: result.error }, { status: result.status });
}
