import { Alert, EmptyState, PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { AttendanceScreen, EndOfDayPanel, attendanceScreen, endOfDayScreen, qrStatus } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L06 s.d. L09 Absen, ditambah Laporan Pulang, jendela serah terima, dan Sudah Pindah Cabang (spec L3d §4).
// QR cetakan membuka alamat ini dengan kode: langkah pindai terlewati.
export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ c?: string; laporan?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.self.check']);
  if (!actor) return <NoAccess />;
  const { c, laporan } = await searchParams;
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
  const extra = await endOfDayScreen(actor);
  // Jendela serah terima muncul sesudah absen Masuk berhasil (KEH-92).
  const showHandovers = data.state.status === 'IN' || data.state.status === 'ON_BREAK';
  return (
    <>
      <PageHeader title="Absen" />
      {status === 'DEAD' && <Alert tone="danger">QR ini sudah tidak berlaku, minta yang baru ke kepala cabang.</Alert>}
      {status === 'UNKNOWN' && <Alert tone="warn">QR tidak dikenal. Pindai QR yang ditempel di cabang.</Alert>}
      <div className="space-y-4">
        <EndOfDayPanel
          pending={extra.pending} relocation={extra.relocation} autoOpen={laporan === '1'}
          handovers={showHandovers ? extra.handovers : []}
        />
        {!(laporan === '1' && extra.pending) && (
          <AttendanceScreen
            branchName={data.branchName} shiftName={data.shiftName} hours={data.hours} state={data.state} times={data.times}
            breakUntil={data.breakUntil} aloneNoBreak={data.aloneNoBreak} presetCode={status === 'ALIVE' ? c! : null}
          />
        )}
      </div>
    </>
  );
}
