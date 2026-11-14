import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { locationScreen, qrLink } from '@/modules/attendance';
import { todayWib } from '@/modules/employees';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

// Lembar cetak QR: hanya QR aktif (KEH-L03). Alamat diambil dari permintaan supaya staging dan produksi benar sendiri.
export default async function PrintQrPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const actor = await requirePageAction('attendance.qr.manage');
  if (!actor) return <NoAccess />;
  const { branch } = await searchParams;
  const data = await locationScreen(actor, todayWib());
  const selected = data.branches.find((row) => row.id === Number(branch));
  if (!selected?.qr) return <p className="text-sm text-ink-muted">Cabang ini belum punya QR aktif.</p>;
  const list = await headers();
  const host = list.get('x-forwarded-host') ?? list.get('host');
  const proto = list.get('x-forwarded-proto') ?? 'https';
  const svg = await QRCode.toString(qrLink(`${proto}://${host}`, selected.qr), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <h1 className="text-2xl font-semibold">{selected.name}</h1>
      <p>Pindai untuk absen</p>
      <div className="mx-auto w-72 bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} />
      <PrintButton />
    </div>
  );
}
