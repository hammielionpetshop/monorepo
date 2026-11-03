import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { moneyCsv } from '@/modules/advances';

export const dynamic = 'force-dynamic';

// Unduh CSV Uang Kasbon satu bulan (spec L5 §9 butir 4): Pemilik, GM, Finance.
export async function GET(req: Request) {
  const session = await currentHrisSession();
  if (!session.ok) return new NextResponse('Perlu masuk', { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const file = await moneyCsv(actor, new URL(req.url).searchParams.get('bulan'));
  if (!file) return new NextResponse('Tidak ditemukan', { status: 404 });
  // BOM supaya Excel membaca huruf dengan benar.
  return new NextResponse(`﻿${file.csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    },
  });
}
