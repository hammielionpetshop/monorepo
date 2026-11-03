import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { loadActor } from '@/modules/access';
import { transferDownload } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Unduh Daftar Transfer CSV (GAJ-L36, spec L4f §3.6): Finance, Pemilik, GM. Tiap unduhan dicatat di Riwayat periode.
export async function GET(req: Request) {
  const session = await currentHrisSession();
  if (!session.ok) return new NextResponse('Perlu masuk', { status: 401 });
  const actor = await loadActor(session.accountId, session.localUserId);
  const period = new URL(req.url).searchParams.get('period') ?? '';
  const file = await transferDownload(actor, period);
  if (!file) return new NextResponse('Tidak ditemukan', { status: 404 });
  // BOM supaya Excel membaca huruf dengan benar.
  return new NextResponse(`﻿${file.csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    },
  });
}
