import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { announceToOwners } from '@/lib/owner-notify';
import { actorForSession } from '@/lib/authz';
import { announceOptions, announcementChoiceSchema, toAnnounceChoice } from '@/modules/announcements';
import { cancelSetting, setSetting, settingAnnouncePreview } from '@/modules/settings';

export const dynamic = 'force-dynamic';

const value = z.union([z.number(), z.string().max(100), z.array(z.string().max(30)).max(10)]);

const bodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('set'),
    key: z.string().min(1).max(100),
    targetKind: z.enum(['ALL', 'POSITION', 'BRANCH']),
    targetId: z.number().int().positive().nullable(),
    value,
    effectiveFrom: z.string().max(10),
    reason: z.string().max(500),
    expectedLatestId: z.number().int().positive().nullable(),
    announcement: announcementChoiceSchema.optional(),
  }),
  z.object({ kind: z.literal('cancel'), id: z.number().int().positive(), reason: z.string().max(500) }),
  // Isi awal langkah Pengumuman (spec F3-3 §4.1); juga dipakai layar lain yang menyimpan pengaturan.
  z.object({
    kind: z.literal('announce_preview'),
    values: z.record(z.string().max(100), z.unknown()),
    targetKind: z.enum(['ALL', 'POSITION', 'BRANCH']),
    targetId: z.number().int().positive().nullable(),
    effectiveFrom: z.string().max(10),
    title: z.string().max(80).optional(),
  }),
]);

// BER-L41 Ubah satu pengaturan. Hak diperiksa per pengaturan di layanan (`editAction` di daftar pengaturan).
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const body = parsed.data;
  if (body.kind === 'announce_preview') {
    const preview = await settingAnnouncePreview(actor, body);
    if (!preview.ok) return NextResponse.json({ error: preview.error }, { status: preview.status });
    return NextResponse.json({ ok: true, preview: preview.data, options: preview.data.required ? await announceOptions() : null });
  }
  const result = body.kind === 'set'
    ? await setSetting(actor, body, announceToOwners, toAnnounceChoice(body.announcement))
    : await cancelSetting(actor, body.id, body.reason, announceToOwners);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
}
