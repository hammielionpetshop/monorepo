import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { comparisonDownload } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Unduh Lembar Banding CSV (spec L9 §4 butir 4). Hanya Pemilik/GM.
export async function GET(req: Request) {
  const session = await currentHrisSession();
  if (!session.ok) return new NextResponse('Perlu masuk', { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const runId = Number(new URL(req.url).searchParams.get('uji'));
  const file = Number.isInteger(runId) && runId > 0 ? await comparisonDownload(actor, runId) : null;
  if (!file) return new NextResponse('Tidak ditemukan', { status: 404 });
  // BOM supaya Excel membaca huruf dengan benar.
  return new NextResponse(`﻿${file.csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    },
  });
}
