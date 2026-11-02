import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { HabitScreen, habitScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L39 Laporan Kebiasaan Lupa Absen (Pemilik dan GM).
export default async function HabitPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const actor = await requirePageAnyAction(['clarification.habit.view']);
  if (!actor) return <NoAccess />;
  const data = await habitScreen(actor, (await searchParams).period ?? null);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Kebiasaan Lupa Absen" description="Hanya untuk Pemilik dan GM. Tanpa nominal." />
      <HabitScreen {...data} />
    </>
  );
}
