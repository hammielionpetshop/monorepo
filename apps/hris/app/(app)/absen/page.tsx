import { Alert, EmptyState, PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { AttendanceScreen, attendanceScreen, qrStatus } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L06 s.d. L09 Absen. QR cetakan membuka alamat ini dengan kode: langkah pindai terlewati.
export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.self.check']);
  if (!actor) return <NoAccess />;
  const { c } = await searchParams;
  const data = await attendanceScreen(actor);
  if (!data.tracked) {
    return (
      <>
        <PageHeader title="Absen" />
        <EmptyState title="Jabatan Anda tidak absen lewat QR.">Tidak ada yang perlu dilakukan di sini.</EmptyState>
      </>
    );
  }
  const status = c ? await qrStatus(c) : null;
  return (
    <>
      <PageHeader title="Absen" />
      {status === 'DEAD' && <Alert tone="danger">QR ini sudah tidak berlaku, minta yang baru ke kepala cabang.</Alert>}
      {status === 'UNKNOWN' && <Alert tone="warn">QR tidak dikenal. Pindai QR yang ditempel di cabang.</Alert>}
      <AttendanceScreen
        branchName={data.branchName} shiftName={data.shiftName} hours={data.hours} state={data.state} times={data.times}
        breakUntil={data.breakUntil} aloneNoBreak={data.aloneNoBreak} presetCode={status === 'ALIVE' ? c! : null}
      />
    </>
  );
}
