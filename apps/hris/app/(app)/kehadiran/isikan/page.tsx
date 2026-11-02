import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { AbsenceFormScreen, absenceFormScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L34 Isikan Pengajuan atas Nama: HR, Pemilik, GM untuk orang lain (KEH-148).
export default async function OnBehalfPage({ searchParams }: { searchParams: Promise<{ orang?: string }> }) {
  const actor = await requirePageAnyAction(['absence.submit_for']);
  if (!actor) return <NoAccess />;
  const { orang } = await searchParams;
  const data = await absenceFormScreen(actor, { employeeId: orang && /^\d+$/.test(orang) ? Number(orang) : null, onBehalf: true });
  if (!data || !data.allowed) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Isikan Pengajuan atas Nama"
        description="Untuk orang yang tidak punya HP atau tidak sempat mengajukan. Batas waktu tetap berlaku, dihitung dari saat diisikan."
      />
      <AbsenceFormScreen key={data.employeeId ?? 'pilih'} {...data} />
    </>
  );
}
