import { cache } from 'react';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { can, hasAction, loadActor, type ActionName, type Actor, type Target } from '@/modules/access';
import { checkMutation, currentHrisSession } from './auth';
import { withFormerAccess } from './former-access';

/** Pelaku dari sesi: `loadActor` + akses terbatas mantan karyawan (spec L4g §3.7). Route memakai ini, bukan `loadActor`. */
export async function actorForSession(accountId: number, localUserId: number): Promise<Actor> {
  const actor = await withFormerAccess(await loadActor(accountId, localUserId));
  // Selama data salinan uji banding ada di staging, hanya Pemilik/GM yang bisa masuk (spec L9 §4, SIS-41).
  if (stagingRestricted() && !actor.fullAccess) {
    return { accountId, personId: localUserId, positionId: null, fullAccess: false, highRights: false, branchId: null, departmentId: null, grants: new Map() };
  }
  return actor;
}

/** Saklar kunci HRIS staging (`HRIS_STAGING_RESTRICT=1`); tidak berlaku di luar staging walau env-nya terpasang. */
export function stagingRestricted(): boolean {
  return process.env.HRIS_STAGING_RESTRICT === '1' && process.env.AUTH_COOKIE_ENV === 'staging';
}

/** Sesi + pelaku untuk permintaan ini. Dimemo per render server, tidak lintas permintaan. */
export const getRequestActor = cache(async () => {
  const session = await currentHrisSession();
  if (!session.ok) return { session, actor: null };
  return { session, actor: await actorForSession(session.accountId, session.localUserId) };
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

/**
 * Penjaga halaman yang datanya disaring per baris (mis. Daftar Karyawan): cukup punya salah satu
 * tindakan dengan lingkup apa pun; layanan memeriksa `can()` per orang.
 */
export async function requirePageAnyAction(actions: ActionName[]): Promise<Actor | null> {
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  return actions.some((action) => hasAction(actor, action)) ? actor : null;
}

type Guarded ={ ok: true; actor: Actor } | { ok: false; response: NextResponse };

/** Penjaga route mutasi: Origin + CSRF, sesi HRIS, lalu tindakan bernama. */
export async function requireMutationAction(req: Request, action: ActionName, target?: Target): Promise<Guarded> {
  const rejected = await checkMutation(req);
  if (rejected) return { ok: false, response: NextResponse.json({ error: rejected }, { status: 403 }) };
  const session = await currentHrisSession();
  if (!session.ok) {
    return { ok: false, response: NextResponse.json({ error: session.error, code: session.code }, { status: 401 }) };
  }
  const actor = await actorForSession(session.accountId, session.localUserId);
  if (!can(actor, action, target)) {
    return { ok: false, response: NextResponse.json({ error: 'Anda tidak berhak melakukan tindakan ini.' }, { status: 403 }) };
  }
  return { ok: true, actor };
}
