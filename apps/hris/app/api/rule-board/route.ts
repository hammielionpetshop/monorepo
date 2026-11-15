import { ruleBoard } from '@/modules/announcements';
import { respond, ruleActor } from '../announcements/rules/session';

export const dynamic = 'force-dynamic';

// Papan Perubahan Aturan untuk akun yang masuk (BER-L08): tab Berlaku atau Riwayat.
export async function GET(req: Request) {
  const guard = await ruleActor(req, false);
  if (!guard.ok) return guard.response;
  const tab = new URL(req.url).searchParams.get('tab') === 'history' ? 'history' : 'current';
  return respond(await ruleBoard(guard.actor, tab));
}
