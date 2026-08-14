import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { getQrPng } from '@/lib/waha';

export const dynamic = 'force-dynamic';

// QR ini setara kunci: siapa pun yang memindainya menautkan perangkatnya ke WhatsApp
// toko. Karena itu dilindungi izin yang sama dengan halamannya, dan tidak boleh
// di-cache di mana pun — QR lama yang tersimpan bisa dipakai orang lain.
export async function GET() {
  const gate = await requirePermission('user.manage');
  if (gate instanceof NextResponse) return gate;

  try {
    const png = await getQrPng();
    return new NextResponse(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('WhatsApp QR error:', error);
    return NextResponse.json(
      { error: 'QR belum tersedia. Pastikan sesi sedang menunggu pemindaian.' },
      { status: 502 },
    );
  }
}
