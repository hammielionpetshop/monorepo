import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { valueTripWagesAfter } from '@/lib/trip-wage-sync';
import { cancelRate, createRate, fixRate, ratePreview } from '@/modules/logistics';
import { markTripWageLooked, rateFixImpact } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const amount = z.number().int().min(0).max(10_000_000);
const numbers = { driverWithAssistant: amount, driverAlone: amount, assistant: amount };
const reason = z.string().max(500);

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('rate_preview'), vehicleId: id, routeId: id, ...numbers }),
  z.object({ action: z.literal('create_rate'), vehicleId: id, routeId: id, effectiveFrom: z.string().max(10), ...numbers }),
  z.object({ action: z.literal('cancel_rate'), rateId: id, reason }),
  z.object({ action: z.literal('fix_preview'), rateId: id, ...numbers }),
  z.object({ action: z.literal('fix_rate'), rateId: id, reason, ...numbers }),
  z.object({ action: z.literal('look'), valueId: id, note: z.string().max(500).nullable() }),
]);

// Gaji Driver L7a (spec L7 §3.1–3.3): tarif ritase (tabel di Logistik) + Buku Upah ritase (modul Gaji). Hak di layanan.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const body = parsed.data;
  const denied = NextResponse.json({ error: 'Anda tidak berhak melakukan tindakan ini.' }, { status: 403 });

  switch (body.action) {
    case 'rate_preview': {
      const preview = await ratePreview(actor, body.vehicleId, body.routeId, body);
      return preview ? NextResponse.json({ ok: true, ...preview }) : denied;
    }
    case 'fix_preview': {
      const impact = await rateFixImpact(actor, body.rateId, body);
      return impact ? NextResponse.json({ ok: true, ...impact }) : denied;
    }
    case 'create_rate': {
      const result = await createRate(actor, body);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      // Tarif pertama sebuah pasangan bisa mengisi upah yang tadinya Belum bertarif.
      if (actor) await valueTripWagesAfter({ pairs: [{ vehicleId: body.vehicleId, routeId: body.routeId }], from: body.effectiveFrom }, actor.accountId);
      return NextResponse.json({ ok: true, ...result.data });
    }
    case 'cancel_rate': {
      const result = await cancelRate(actor, body.rateId, body.reason);
      return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
    }
    case 'fix_rate': {
      const impact = await rateFixImpact(actor, body.rateId, body);
      if (!impact) return denied;
      if (impact.blocked) return NextResponse.json({ error: impact.blocked }, { status: 409 });
      const result = await fixRate(actor, body.rateId, body, body.reason);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      if (actor) {
        await valueTripWagesAfter({ pairs: [{ vehicleId: impact.rate.vehicleId, routeId: impact.rate.routeId }], from: impact.rate.from }, actor.accountId);
      }
      const people = impact.perPerson.length;
      return NextResponse.json({ ok: true, message: `Tarif dibetulkan. ${impact.rows.length} upah dinilai ulang${people ? `; ${people} orang diberi tahu` : ''}.` });
    }
    case 'look': {
      const result = await markTripWageLooked(actor, body.valueId, body.note);
      return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
    }
  }
}
