import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { getSession, startSession, logoutSession, restartSession } from '@/lib/waha';

export const dynamic = 'force-dynamic';

// `user.manage` = tingkat OWNER, izin yang sama dengan halaman Keamanan. Dipakai di
// sini karena menautkan/memutus WhatsApp toko setara sensitifnya: siapa pun yang bisa,
// bisa mengalihkan jalur OTP seluruh pelanggan.
const IZIN = 'user.manage';

export async function GET() {
  const gate = await requirePermission(IZIN);
  if (gate instanceof NextResponse) return gate;

  try {
    return NextResponse.json(await getSession());
  } catch (error) {
    console.error('WhatsApp status error:', error);
    return NextResponse.json(
      { error: 'Tidak bisa menghubungi layanan WhatsApp' },
      { status: 502 },
    );
  }
}

export async function POST(req: Request) {
  const gate = await requirePermission(IZIN);
  if (gate instanceof NextResponse) return gate;

  if (req.headers.get('content-type')?.includes('application/json') !== true) {
    return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 });
  }

  const body = await req.json().catch(() => null);
  const aksi = body?.aksi;

  try {
    if (aksi === 'mulai') {
      await startSession();
    } else if (aksi === 'putuskan') {
      await logoutSession();
    } else if (aksi === 'nyalakan_ulang') {
      await restartSession();
    } else {
      return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 });
    }

    return NextResponse.json(await getSession());
  } catch (error) {
    console.error('WhatsApp aksi error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Aksi gagal dijalankan' },
      { status: 502 },
    );
  }
}
