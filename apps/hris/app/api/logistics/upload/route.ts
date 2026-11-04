import { NextResponse } from 'next/server';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { arriveTrip, closeByOffice, departTrip, finishPickup, finishShopping, headHome, processVisit, sendEndReport } from '@/modules/logistics';
import { valueTripWagesAfter } from '@/lib/trip-wage-sync';

export const dynamic = 'force-dynamic';

const positive = (value: FormDataEntryValue | null) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const coord = (value: FormDataEntryValue | null) => (value == null || value === '' ? null : Number(value));
const text = (value: FormDataEntryValue | null | undefined, max: number) => (typeof value === 'string' ? value.slice(0, max) : null);
const OUTCOMES = { deliver_visit: 'DELIVERED', tomorrow_visit: 'TOMORROW', fail_visit: 'FAILED' } as const;

// Aksi trip berfoto (spec L6 §3.3, 3.4, 3.6; LT1 §3.5, §13.3): Berangkat (foto awak), Belanja selesai (foto nota), Ambil barang di cabang
// asal (foto barang diterima driver), kunjungan Terkirim / Kirim Besok / Gagal, Menuju Garasi (foto bak kosong), Sampai Garasi
// (foto amper bensin), Laporan Pulang trip (foto mobil boleh), Tutup atas nama driver (foto bukti).
// Jam = jam server saat permintaan ini diterima.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const action = form?.get('action');
  const tripId = positive(form?.get('tripId') ?? null);
  const photoValue = form?.get('photo');
  const photo = photoValue instanceof File ? photoValue : null;
  if (!form || !tripId) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await actorForSession(session.accountId, session.localUserId);

  const point = { latitude: coord(form?.get('latitude') ?? null), longitude: coord(form?.get('longitude') ?? null), accuracy: coord(form?.get('accuracy') ?? null) };
  const result = await (async () => {
    if (typeof action === 'string' && action in OUTCOMES) {
      const visitId = positive(form.get('visitId'));
      if (!visitId) return { ok: false as const, status: 400 as const, error: 'Data tidak valid.' };
      return processVisit(actor, tripId, visitId, {
        outcome: OUTCOMES[action as keyof typeof OUTCOMES], reasonCode: text(form.get('reasonCode'), 40), note: text(form.get('note'), 300), point,
      }, photo);
    }
    if (action === 'head_home') return headHome(actor, tripId, photo, text(form.get('earlyReason'), 500));
    if (action === 'arrive') return arriveTrip(actor, tripId, point, photo);
    if (action === 'end_report') {
      return sendEndReport(actor, tripId, {
        condition: text(form.get('condition'), 20) ?? '', conditionNote: text(form.get('conditionNote'), 600),
        needsFuel: form.get('needsFuel') === '1', fuelEstimate: coord(form.get('fuelEstimate')), problemNote: text(form.get('problemNote'), 1100),
      }, photo);
    }
    if (action === 'depart') {
      return departTrip(actor, tripId, photo, { latitude: coord(form.get('latitude')), longitude: coord(form.get('longitude')), accuracy: coord(form.get('accuracy')) });
    }
    if (action === 'shopping_done') {
      const shoppingId = positive(form.get('shoppingId'));
      if (!shoppingId) return { ok: false as const, status: 400 as const, error: 'Data tidak valid.' };
      return finishShopping(actor, tripId, shoppingId, photo);
    }
    if (action === 'pickup_done') {
      const pickupId = positive(form.get('pickupId'));
      if (!pickupId) return { ok: false as const, status: 400 as const, error: 'Data tidak valid.' };
      return finishPickup(actor, tripId, pickupId, photo);
    }
    if (action === 'office_close') return closeByOffice(actor, tripId, String(form.get('reason') ?? '').slice(0, 500), photo);
    return { ok: false as const, status: 400 as const, error: 'Data tidak valid.' };
  })();
  // Upah ritase dinilai sesudah trip Selesai (spec L7 §3.2).
  if (result.ok && actor && (action === 'office_close' || action === 'arrive')) await valueTripWagesAfter({ tripId }, actor.accountId);
  return result.ok ? NextResponse.json({ ok: true, ...(result.data ?? {}) }) : NextResponse.json({ error: result.error }, { status: result.status });
}
