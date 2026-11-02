import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { loadActor } from '@/modules/access';
import { adjustLeave, previewAbsence, submitDoctorLetter } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('preview'), fields: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal('adjust'), employeeId: z.number().int().positive(), days: z.number().int(), reason: z.string().max(500) }),
]);

type Result = { ok: true; data: object } | { ok: false; status: number; error: string; hint?: string };

function respond(result: Result) {
  return result.ok
    ? NextResponse.json({ ok: true, ...result.data })
    : NextResponse.json({ error: result.error, hint: result.hint ?? null }, { status: result.status });
}

// Izin, Sakit, dan Cuti (spec L3f): pratinjau hitungan, susulkan surat dokter (multipart), sesuaikan sisa cuti.
// Kirim pengajuannya lewat Mesin Pengajuan (/api/requests). Semua aturan dan hak diperiksa di layanan.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const actor = await loadActor(session.accountId, session.localUserId);

  if ((req.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    const absenceId = Number(form?.get('absenceId'));
    const photo = form?.get('photo');
    if (!form || !Number.isInteger(absenceId) || absenceId <= 0) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
    return respond(await submitDoctorLetter(actor, absenceId, photo instanceof File && photo.size > 0 ? photo : null));
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const body = parsed.data;
  if (body.action === 'preview') return respond(await previewAbsence(actor, body.fields));
  return respond(await adjustLeave(actor, body));
}
