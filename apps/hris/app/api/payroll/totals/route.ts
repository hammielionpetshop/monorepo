import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { totalsDownload } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Unduh Total Diterima per Orang CSV (GAJ-L43, spec L4g §3.8): Pemilik, GM, HR tanpa jabatan bertanda. Tiap unduhan dicatat.
export async function GET(req: Request) {
  const session = await currentHrisSession();
  if (!session.ok) return new NextResponse('Perlu masuk', { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const file = await totalsDownload(actor, { dari: q.dari, sampai: q.sampai, cabang: q.cabang, jabatan: q.jabatan, status: q.status, cari: q.cari });
  if (!file) return new NextResponse('Tidak ditemukan', { status: 404 });
  // BOM supaya Excel membaca huruf dengan benar.
  return new NextResponse(`﻿${file.csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    },
  });
}
