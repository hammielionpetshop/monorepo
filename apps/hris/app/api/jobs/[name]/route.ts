import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runJob } from '@/modules/shared';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ name: string }> }) {
  const secret = process.env.JOB_SECRET;
  const key = request.headers.get('x-job-key');
  if (!secret || !key || Buffer.byteLength(secret) !== Buffer.byteLength(key)
    || !timingSafeEqual(Buffer.from(secret), Buffer.from(key))) {
    return NextResponse.json({ error: 'Kunci pekerjaan tidak valid.' }, { status: 401 });
  }

  const { name } = await context.params;
  try {
    const result = await runJob(name);
    if (!result) return NextResponse.json({ error: 'Pekerjaan tidak ditemukan.' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Gagal menjalankan pekerjaan terjadwal:', name, error);
    return NextResponse.json({ error: 'Pekerjaan gagal dijalankan.' }, { status: 500 });
  }
}
