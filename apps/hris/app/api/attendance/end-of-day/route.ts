import { NextResponse } from 'next/server';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { loadActor } from '@/modules/access';
import { submitEndOfDay } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const fileOf = (value: FormDataEntryValue | null) => (value instanceof File && value.size > 0 ? value : null);

function idsOf(value: FormDataEntryValue | null): number[] {
  try {
    const parsed = JSON.parse(String(value ?? '[]'));
    return Array.isArray(parsed) ? parsed.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
  } catch {
    return [];
  }
}

// Kirim Laporan Pulang (KEH-L20): serah terima, masalah (opsional), lalu Kirim. Jam = jam server.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const dayId = Number(form?.get('dayId'));
  const mode = form?.get('recipientMode');
  if (!form || !Number.isInteger(dayId) || dayId <= 0 || (mode !== 'TEAM' && mode !== 'PEOPLE')) {
    return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  }
  const problemBody = String(form.get('problem') ?? '');
  const actor = await loadActor(session.accountId, session.localUserId);
  const result = await submitEndOfDay(actor, {
    dayId, handover: String(form.get('handover') ?? ''), recipientMode: mode, recipientIds: idsOf(form.get('recipientIds')),
    handoverPhoto: fileOf(form.get('handoverPhoto')),
    problem: problemBody.trim()
      ? { body: problemBody, photo: fileOf(form.get('problemPhoto')), concernsGm: form.get('concernsGm') === 'true' }
      : null,
  });
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}
