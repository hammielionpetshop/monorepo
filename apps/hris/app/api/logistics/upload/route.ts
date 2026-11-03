import { NextResponse } from 'next/server';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { closeByOffice, departTrip, finishShopping } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

const positive = (value: FormDataEntryValue | null) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const coord = (value: FormDataEntryValue | null) => (value == null || value === '' ? null : Number(value));

// Aksi trip berfoto (spec L6 §3.3, 3.4, 3.6): Berangkat (foto awak), Belanja selesai (foto nota), Tutup atas nama driver (foto bukti).
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

  const result = await (async () => {
    if (action === 'depart') {
      return departTrip(actor, tripId, photo, { latitude: coord(form.get('latitude')), longitude: coord(form.get('longitude')), accuracy: coord(form.get('accuracy')) });
    }
    if (action === 'shopping_done') {
      const shoppingId = positive(form.get('shoppingId'));
      if (!shoppingId) return { ok: false as const, status: 400 as const, error: 'Data tidak valid.' };
      return finishShopping(actor, tripId, shoppingId, photo);
    }
    if (action === 'office_close') return closeByOffice(actor, tripId, String(form.get('reason') ?? '').slice(0, 500), photo);
    return { ok: false as const, status: 400 as const, error: 'Data tidak valid.' };
  })();
  return result.ok ? NextResponse.json({ ok: true, ...(result.data ?? {}) }) : NextResponse.json({ error: result.error }, { status: result.status });
}
