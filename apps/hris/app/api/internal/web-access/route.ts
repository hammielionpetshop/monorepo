import { NextResponse } from 'next/server';
import { actorForSession } from '@/lib/authz';
import { hrisPersonOfSession, internalCallAllowed, logisticsWebAllowed } from '@/lib/web-split-server';
import { shellSettingsToday } from '@/modules/settings';

export const dynamic = 'force-dynamic';

/**
 * Hak web Logistik untuk gateway Back Office (spec F2-7b §5). Hanya dari jaringan dalam (Caddy menolak `/api/internal`
 * dari luar); penolakan pagar berbentuk 404 polos agar pintu tidak terdeteksi.
 */
export async function GET(req: Request) {
  if (!internalCallAllowed(req)) return new NextResponse(null, { status: 404 });
  const person = await hrisPersonOfSession(req.headers.get('x-actor-session') ?? '');
  if (!person) return NextResponse.json({ logistics: false });
  const [actor, shell] = await Promise.all([actorForSession(person.accountId, person.personId), shellSettingsToday()]);
  const logistics = !actor.limited && await logisticsWebAllowed(actor, shell.today);
  return NextResponse.json({ logistics }, { headers: { 'Cache-Control': 'no-store' } });
}
