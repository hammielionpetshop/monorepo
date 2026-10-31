import { cache } from 'react';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { can, loadActor, type ActionName, type Actor, type Target } from '@/modules/access';
import { checkMutation, currentHrisSession } from './auth';

/** Sesi + pelaku untuk permintaan ini. Dimemo per render server, tidak lintas permintaan. */
export const getRequestActor = cache(async () => {
  const session = await currentHrisSession();
  if (!session.ok) return { session, actor: null };
  return { session, actor: await loadActor(session.accountId, session.localUserId) };
});

/**
 * Penjaga halaman. Tanpa sesi → ke halaman masuk. Mengembalikan pelaku bila berhak, null bila tidak
 * (halaman menampilkan "tidak punya akses"); menu yang tersembunyi bukan penjaga (SIS-36).
 */
export async function requirePageAction(action: ActionName, target?: Target): Promise<Actor | null> {
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  return can(actor, action, target) ? actor : null;
}

type Guarded = { ok: true; actor: Actor } | { ok: false; response: NextResponse };

/** Penjaga route mutasi: Origin + CSRF, sesi HRIS, lalu tindakan bernama. */
export async function requireMutationAction(req: Request, action: ActionName, target?: Target): Promise<Guarded> {
  const rejected = await checkMutation(req);
  if (rejected) return { ok: false, response: NextResponse.json({ error: rejected }, { status: 403 }) };
  const session = await currentHrisSession();
  if (!session.ok) {
    return { ok: false, response: NextResponse.json({ error: session.error, code: session.code }, { status: 401 }) };
  }
  const actor = await loadActor(session.accountId, session.localUserId);
  if (!can(actor, action, target)) {
    return { ok: false, response: NextResponse.json({ error: 'Anda tidak berhak melakukan tindakan ini.' }, { status: 403 }) };
  }
  return { ok: true, actor };
}
