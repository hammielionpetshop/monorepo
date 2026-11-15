import { NextResponse } from 'next/server';
import { z } from 'zod';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { publishDraft } from '@/modules/announcements';
import { submitRequest } from '@/modules/requests';
import { idOf, respond, ruleActor } from '../../../session';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ mode: z.enum(['now', 'schedule', 'submit']) });

// Terbitkan / Jadwalkan, atau Kirim untuk disetujui (pengumuman uang oleh HR) lewat Mesin Pengajuan (spec F3-3 §3.4).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await ruleActor(req, true);
  if (!guard.ok) return guard.response;
  const id = idOf((await params).id);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!id || !parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  if (parsed.data.mode === 'submit') {
    const result = await submitRequest(guard.actor, 'rule_announcement', REQUEST_HANDLERS.rule_announcement, { fields: { draftId: id }, attachmentIds: [] });
    return result.ok ? NextResponse.json({ requestId: result.data.id, message: result.data.message }) : NextResponse.json({ error: result.error }, { status: result.status });
  }
  return respond(await publishDraft(guard.actor, id, parsed.data.mode));
}
