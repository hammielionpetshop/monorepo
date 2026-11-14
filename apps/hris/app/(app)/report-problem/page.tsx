import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { MyProblemsScreen, myProblemsScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L23 Lapor Masalah: kirim laporan rahasia ke Pemilik dan GM; status dan tanggapan tampil di sini.
export default async function ReportProblemPage() {
  const actor = await requirePageAnyAction(['attendance.self.check']);
  if (!actor) return <NoAccess />;
  const data = await myProblemsScreen(actor);
  return (
    <>
      <PageHeader title="Lapor Masalah" description="Rahasia: hanya Pemilik dan GM yang membaca." />
      <MyProblemsScreen {...data} />
    </>
  );
}
