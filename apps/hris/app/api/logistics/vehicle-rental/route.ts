import { NextResponse } from 'next/server';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import {
  cancelRentalRate, cancelVehicleRentalPayment, createRentalRate, fixRentalRate, payVehicleRental, setVehicleOwnership,
} from '@/modules/logistics';

export const dynamic = 'force-dynamic';

const positive = (value: FormDataEntryValue | null) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const amountOf = (value: FormDataEntryValue | null) => (value == null || value === '' ? NaN : Number(value));
const text = (value: FormDataEntryValue | null, max: number) => (typeof value === 'string' ? value.slice(0, max) : null);

// Sewa Mobil (F2-5b, spec F2-5 §3): kepemilikan & tarif sewa (Mobil & Rute), Bayar / Bayar susulan berfoto, batal. Hak diperiksa di layanan.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const action = form.get('action');
  const invalid = { ok: false as const, status: 400 as const, error: 'Data tidak valid.' };
  const id = positive(form.get('id'));
  const vehicleId = positive(form.get('vehicleId'));
  const reason = text(form.get('reason'), 500) ?? '';

  const result = await (async () => {
    switch (action) {
      case 'set_ownership': {
        const ownership = form.get('ownership');
        if (!vehicleId || (ownership !== 'OWNED' && ownership !== 'RENTED')) return invalid;
        return setVehicleOwnership(actor, { vehicleId, ownership, ownerName: text(form.get('ownerName'), 200), ownerNote: text(form.get('ownerNote'), 600) });
      }
      case 'create_rate':
        return vehicleId ? createRentalRate(actor, { vehicleId, effectiveFrom: text(form.get('effectiveFrom'), 10) ?? '', amount: amountOf(form.get('amount')) }) : invalid;
      case 'cancel_rate':
        return id ? cancelRentalRate(actor, id, reason) : invalid;
      case 'fix_rate':
        return id ? fixRentalRate(actor, id, amountOf(form.get('amount')), reason) : invalid;
      case 'pay': {
        const kind = form.get('kind');
        const moneyPlaceId = positive(form.get('moneyPlaceId'));
        if (!vehicleId || (kind !== 'PAYMENT' && kind !== 'TOP_UP')) return invalid;
        if (!moneyPlaceId) return { ok: false as const, status: 400 as const, error: 'Pilih Dibayar dari.' };
        const photoValue = form.get('photo');
        return payVehicleRental(actor, {
          vehicleId, kind, moneyPlaceId, month: text(form.get('month'), 7) ?? '', occurredOn: text(form.get('occurredOn'), 10) ?? '',
          amount: amountOf(form.get('amount')), differenceReason: text(form.get('differenceReason'), 500),
        }, photoValue instanceof File && photoValue.size > 0 ? photoValue : null);
      }
      case 'cancel_payment':
        return id ? cancelVehicleRentalPayment(actor, id, reason) : invalid;
      default:
        return invalid;
    }
  })();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, ...(result.data ?? {}) });
}
