import { EmptyState, PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { MyDaysOffScreen, myDaysOffScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L26 Pilih Libur.
export default async function MyDaysOffPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.self.check']);
  if (!actor) return <NoAccess />;
  const { period } = await searchParams;
  const data = await myDaysOffScreen(actor, period ?? null);
  return (
    <>
      <PageHeader title="Pilih Libur" description="Pilih sendiri tanggal libur tiap periode 26–25. Langsung berlaku tanpa persetujuan." />
      {data.tracked ? <MyDaysOffScreen key={`${data.periodStart}-${data.myDates.join()}`} {...data} />
        : <EmptyState title="Libur pilihan tidak berlaku untuk jabatan Anda." />}
    </>
  );
}
