import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { logisticsReportDownload } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Unduh Laporan Logistik CSV per tab (spec LT1 §17.2; LOG-145): dibuat server, tiap unduhan dicatat.
export async function GET(req: Request) {
  const session = await currentHrisSession();
  if (!session.ok) return new NextResponse('Perlu masuk', { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const file = await logisticsReportDownload(actor, { tab: q.tab, periode: q.periode, dari: q.dari, sampai: q.sampai, mobil: q.mobil, cabang: q.cabang });
  if (!file) return new NextResponse('Tidak ditemukan atau rentang tidak sah', { status: 404 });
  // BOM supaya Excel membaca huruf dengan benar.
  return new NextResponse(`﻿${file.csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    },
  });
}
