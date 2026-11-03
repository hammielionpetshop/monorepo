import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { perPersonDownload } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Unduh Bongkaran per Orang CSV (DRV-L22): Pemilik, GM, Finance, Kepala Gudang. Tiap unduhan dicatat.
export async function GET(req: Request) {
  const session = await currentHrisSession();
  if (!session.ok) return new NextResponse('Perlu masuk', { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const q = new URL(req.url).searchParams;
  const file = await perPersonDownload(actor, { from: q.get('dari'), to: q.get('sampai') });
  if (!file) return new NextResponse('Tidak ditemukan', { status: 404 });
  return new NextResponse(`﻿${file.csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    },
  });
}
