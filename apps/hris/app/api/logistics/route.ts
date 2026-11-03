import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import {
  addCrew, addManualWage, addShopping, arriveTrip, cancelTrip, cancelWage, createTrip, dropShopping, removeCrew, saveRoute, saveVehicle, setFleetActive,
  setGarageBranch, turnFenceOff, turnFenceOn, updateDraft,
} from '@/modules/logistics';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const reason = z.string().max(500);
const coord = z.number().nullable().optional();
const tripBody = {
  vehicleId: id, routeId: id.nullable(), shoppingRouteIds: z.array(id).max(20), driverId: id, assistantIds: z.array(id).max(10),
};

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), ...tripBody }),
  z.object({ action: z.literal('update'), tripId: id, ...tripBody }),
  z.object({ action: z.literal('cancel'), tripId: id, reason }),
  z.object({ action: z.literal('add_crew'), tripId: id, employeeId: id, role: z.enum(['DRIVER', 'ASSISTANT']) }),
  z.object({ action: z.literal('remove_crew'), tripId: id, crewId: id, reason }),
  z.object({ action: z.literal('add_shopping'), tripId: id, routeId: id }),
  z.object({ action: z.literal('drop_shopping'), tripId: id, shoppingId: id, reason }),
  z.object({ action: z.literal('arrive'), tripId: id, latitude: coord, longitude: coord, accuracy: coord }),
  z.object({ action: z.literal('cancel_wage'), wageId: id, reason }),
  z.object({
    action: z.literal('manual_wage'), employeeId: id, tripDate: z.string().max(10), vehicleId: id, routeId: id, role: z.enum(['DRIVER', 'ASSISTANT']),
    withAssistant: z.boolean(), reason, confirmTwice: z.boolean(),
  }),
  z.object({ action: z.literal('save_vehicle'), id: id.nullable().optional(), name: z.string().max(100), plate: z.string().max(40) }),
  z.object({ action: z.literal('save_route'), id: id.nullable().optional(), name: z.string().max(100), kind: z.enum(['DELIVERY', 'SHOPPING']) }),
  z.object({ action: z.literal('set_active'), target: z.enum(['vehicle', 'route']), id, active: z.boolean() }),
  z.object({ action: z.literal('set_garage'), branchId: id }),
  z.object({ action: z.literal('fence_off'), hours: z.number().int(), reason }),
  z.object({ action: z.literal('fence_on') }),
]);

// Logistik Minimal (spec L6 §3). Hak diperiksa di layanan per tindakan; aksi berfoto lewat /api/logistics/upload.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const body = parsed.data;

  const result = await (async () => {
    switch (body.action) {
      case 'create': return createTrip(actor, body);
      case 'update': return updateDraft(actor, body.tripId, body);
      case 'cancel': return cancelTrip(actor, body.tripId, body.reason);
      case 'add_crew': return addCrew(actor, body.tripId, body.employeeId, body.role);
      case 'remove_crew': return removeCrew(actor, body.tripId, body.crewId, body.reason);
      case 'add_shopping': return addShopping(actor, body.tripId, body.routeId);
      case 'drop_shopping': return dropShopping(actor, body.tripId, body.shoppingId, body.reason);
      case 'arrive': return arriveTrip(actor, body.tripId, body);
      case 'cancel_wage': return cancelWage(actor, body.wageId, body.reason);
      case 'manual_wage': return addManualWage(actor, body);
      case 'save_vehicle': return saveVehicle(actor, body);
      case 'save_route': return saveRoute(actor, body);
      case 'set_active': return setFleetActive(actor, body.target, body.id, body.active);
      case 'set_garage': return setGarageBranch(actor, body.branchId);
      case 'fence_off': return turnFenceOff(actor, body.hours, body.reason);
      case 'fence_on': return turnFenceOn(actor);
    }
  })();
  return result.ok ? NextResponse.json({ ok: true, ...(result.data ?? {}) }) : NextResponse.json({ error: result.error }, { status: result.status });
}
