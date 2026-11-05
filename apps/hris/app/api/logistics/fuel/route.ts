import { NextResponse } from 'next/server';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { correctFuel, fillFuelRequest, recordFuelWithoutRequest, voidFuel } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

const positive = (value: FormDataEntryValue | null) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const amountOf = (value: FormDataEntryValue | null) => (value == null || value === '' ? NaN : Number(value));
const text = (value: FormDataEntryValue | null, max: number) => (typeof value === 'string' ? value.slice(0, max) : null);

// Bensin (spec LT1 §17.1 butir 1–4): isi nominal + foto struk, catat tanpa permintaan, ubah, batal. Hak diperiksa di layanan.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const photoValue = form.get('photo');
  const photo = photoValue instanceof File && photoValue.size > 0 ? photoValue : null;
  const action = form.get('action');
  const invalid = { ok: false as const, status: 400 as const, error: 'Data tidak valid.' };

  const result = await (async () => {
    if (action === 'fill') {
      const requestId = positive(form.get('requestId'));
      return requestId ? fillFuelRequest(actor, requestId, amountOf(form.get('amount')), photo) : invalid;
    }
    const vehicleId = positive(form.get('vehicleId'));
    const driverId = positive(form.get('driverId'));
    if (action === 'record') {
      if (!vehicleId || !driverId) return { ok: false as const, status: 400 as const, error: 'Pilih mobil dan driver.' };
      return recordFuelWithoutRequest(actor, {
        vehicleId, driverId, amount: amountOf(form.get('amount')), reasonCode: text(form.get('reasonCode'), 20), reasonText: text(form.get('reasonText'), 300),
      }, photo);
    }
    const fillId = positive(form.get('fillId'));
    if (!fillId) return invalid;
    if (action === 'correct') {
      return correctFuel(actor, fillId, {
        vehicleId: vehicleId ?? 0, driverId: driverId ?? 0, amount: amountOf(form.get('amount')), reason: text(form.get('reason'), 500) ?? '',
      }, photo);
    }
    if (action === 'void') return voidFuel(actor, fillId, text(form.get('reason'), 500) ?? '');
    return invalid;
  })();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
