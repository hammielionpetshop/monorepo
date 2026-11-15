import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireMutationAction } from '@/lib/authz';
import {
  createAccount, createRecoveryCodeFor, linkAccount, resetAccountPassword, revokeEmployeeSessions, setKasirAccess, unlinkAccount,
} from '@/modules/accounts';
import type { ActionName, ServiceResult } from '@/modules/access';
import { loadTarget } from '@/modules/employees';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('create'), email: z.string().max(255), password: z.string().max(1024) }),
  z.object({ kind: z.literal('link'), accountId: z.number().int().positive() }),
  z.object({ kind: z.literal('unlink'), reason: z.string().max(500) }),
  z.object({ kind: z.literal('reset_password'), password: z.string().max(1024) }),
  z.object({ kind: z.literal('recovery_code') }),
  z.object({ kind: z.literal('revoke_sessions') }),
  z.object({
    kind: z.literal('kasir'), active: z.boolean(), roleName: z.string().max(20).optional(),
    branchId: z.number().int().positive().optional(), assignedBranchIds: z.array(z.number().int().positive()).max(50).optional(),
  }),
]);

const ACTION_BY_KIND: Record<z.infer<typeof bodySchema>['kind'], ActionName> = {
  create: 'account.manage',
  link: 'account.manage',
  unlink: 'account.manage',
  reset_password: 'account.reset_password',
  recovery_code: 'account.reset_password',
  revoke_sessions: 'sessions.revoke',
  kasir: 'backoffice_access.manage',
};

// Akun seorang karyawan (spec L2d §5–6). Route memeriksa hak atas orang itu (termasuk larangan atas diri
// sendiri); layanan auth menolak lagi tindakan atas akun pelaku sendiri.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  if (!/^\d+$/.test(rawId)) return NextResponse.json({ error: 'Karyawan tidak ditemukan.' }, { status: 404 });
  const id = Number(rawId);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const body = parsed.data;

  const target = await loadTarget(id);
  if (!target) return NextResponse.json({ error: 'Karyawan tidak ditemukan.' }, { status: 404 });
  const guard = await requireMutationAction(req, ACTION_BY_KIND[body.kind], target);
  if (!guard.ok) return guard.response;
  const actor = guard.actor;

  const run = async (): Promise<ServiceResult<object>> => {
    switch (body.kind) {
      case 'create': return createAccount(actor, id, body);
      case 'link': return linkAccount(actor, id, body.accountId);
      case 'unlink': return unlinkAccount(actor, id, body.reason);
      case 'reset_password': return resetAccountPassword(actor, id, body.password);
      case 'recovery_code': return createRecoveryCodeFor(actor, id);
      case 'revoke_sessions': return revokeEmployeeSessions(actor, id);
      case 'kasir': return setKasirAccess(actor, id, body);
    }
  };
  const result = await run();
  return result.ok
    ? NextResponse.json({ ok: true, ...result.data })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
