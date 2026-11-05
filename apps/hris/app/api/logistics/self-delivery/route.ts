import { NextResponse } from 'next/server';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { finishSelfTrip, proposeFromSelfStop, receiveSelfCash, selfStopOutcome, startSelfTrip } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

const positive = (value: FormDataEntryValue | null) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const coord = (value: FormDataEntryValue | null) => (value == null || value === '' ? null : Number(value));
const text = (value: FormDataEntryValue | null | undefined, max: number) => (typeof value === 'string' ? value.slice(0, max) : null);
const fileOf = (value: FormDataEntryValue | null) => (value instanceof File ? value : null);
const OUTCOMES = { deliver: 'DELIVERED', tomorrow: 'TOMORROW', fail: 'FAILED' } as const;
const bad = { ok: false as const, status: 400 as const, error: 'Data tidak valid.' };

// Antar sendiri (spec LT1 §15.2): Mulai antar (Foto 1), hasil tujuan (Foto 2 + cara bayar), Kembali (Foto 3), terima tunai,
// dan titik toko dari tujuan. Jam = jam server saat permintaan diterima.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const action = form.get('action');
  const tripId = positive(form.get('tripId'));
  const photo = fileOf(form.get('photo'));
  const point = { latitude: coord(form.get('latitude')), longitude: coord(form.get('longitude')), accuracy: coord(form.get('accuracy')) };
  const result = await (async () => {
    if (action === 'start') {
      const transactionIds = String(form.get('transactionIds') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50);
      return startSelfTrip(actor, { transactionIds, point }, photo);
    }
    if (!tripId) return bad;
    if (typeof action === 'string' && action in OUTCOMES) {
      const stopId = positive(form.get('stopId'));
      if (!stopId) return bad;
      return selfStopOutcome(actor, tripId, stopId, {
        outcome: OUTCOMES[action as keyof typeof OUTCOMES], reasonCode: text(form.get('reasonCode'), 40), note: text(form.get('note'), 300), point,
        payment: { method: text(form.get('payMethod'), 20), partialAmount: coord(form.get('partialAmount')), promiseDate: text(form.get('promiseDate'), 10) },
      }, photo, fileOf(form.get('proof')));
    }
    if (action === 'finish') return finishSelfTrip(actor, tripId, { gapReason: text(form.get('gapReason'), 40), gapNote: text(form.get('gapNote'), 300), point }, photo);
    if (action === 'cash') return receiveSelfCash(actor, tripId);
    if (action === 'store_point') {
      const stopId = positive(form.get('stopId'));
      const kind = form.get('kind');
      if (!stopId || (kind !== 'NEW' && kind !== 'CORRECTION')) return bad;
      return proposeFromSelfStop(actor, tripId, stopId, { kind, reason: text(form.get('reason'), 400), point }, photo);
    }
    return bad;
  })();
  return result.ok ? NextResponse.json({ ok: true, ...(result.data ?? {}) }) : NextResponse.json({ error: result.error }, { status: result.status });
}
