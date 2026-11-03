import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { DriverFinesScreen, finesScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// DRV-L07 Denda Driver & Kenek (spec L7 §3.6, §4): Menunggu, Berlaku, Selesai.
export default async function DriverFinesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await requirePageAnyAction(['fine.propose', 'fine.view', 'fine.decide']);
  if (!actor) return <NoAccess />;
  const data = await finesScreen(actor, (await searchParams).tab ?? null);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Denda Driver & Kenek" description="Denda per kejadian untuk orang Mingguan dan awak trip. Nominal mengikuti Jenis Denda." actions={<NewBadge feature="/gaji/denda-driver" />} />
      <DriverFinesScreen {...data} />
    </>
  );
}
