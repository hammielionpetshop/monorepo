import { Alert, PageHeader } from '@/components/ui/surface';
import { qrStatus } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// Penampung sampai absen dibuka (spec L3a §4): QR yang dicetak sekarang tetap berlaku nanti.
export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const status = c ? await qrStatus(c) : 'UNKNOWN';
  return (
    <>
      <PageHeader title="Absen" />
      {status === 'ALIVE' && <Alert tone="info" title="QR ini berlaku">Absen dibuka pada update berikutnya.</Alert>}
      {status === 'DEAD' && <Alert tone="danger">QR ini sudah tidak berlaku, minta yang baru ke kepala cabang.</Alert>}
      {status === 'UNKNOWN' && <Alert tone="warn">QR tidak dikenal. Pindai QR yang ditempel di cabang.</Alert>}
    </>
  );
}
