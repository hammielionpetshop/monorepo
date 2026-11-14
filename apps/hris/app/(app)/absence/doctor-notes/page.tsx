import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { DoctorLetterScreen, pendingLettersScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L32 Susulkan Surat Dokter (hanya pengaju).
export default async function DoctorLetterPage() {
  const actor = await requirePageAnyAction(['attendance.self.check']);
  if (!actor) return <NoAccess />;
  return (
    <>
      <PageHeader title="Susulkan Surat Dokter" description="Surat yang masuk dalam batas membuat hari sakit dihitung sakit dengan surat." />
      <DoctorLetterScreen letters={await pendingLettersScreen(actor)} />
    </>
  );
}
